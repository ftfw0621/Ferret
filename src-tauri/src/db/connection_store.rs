use std::fs;
use std::path::{Path, PathBuf};

use super::types::ConnectionConfig;

/// Stored connection (without password — password goes to keyring)
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredConnection {
    id: String,
    name: String,
    driver_type: super::types::DriverType,
    host: String,
    port: u16,
    database: String,
    username: String,
    ssl_mode: super::types::SslMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<String>,
}

fn default_config_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.ftfw.ferret")
}

fn config_file(base: &Path) -> PathBuf {
    base.join("connections.json")
}

fn ensure_dir(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create config dir: {e}"))
}

/// Load stored connections from disk. Passwords are loaded from keyring separately.
pub fn load_connections(config_dir: Option<&Path>) -> Vec<ConnectionConfig> {
    let dir = config_dir
        .map(|p| p.to_path_buf())
        .unwrap_or_else(default_config_dir);
    let file = config_file(&dir);

    let data = match fs::read_to_string(&file) {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    let stored: Vec<StoredConnection> = match serde_json::from_str(&data) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    stored
        .into_iter()
        .map(|s| {
            let password = load_password(&s.id);
            ConnectionConfig {
                id: s.id,
                name: s.name,
                driver_type: s.driver_type,
                host: s.host,
                port: s.port,
                database: s.database,
                username: s.username,
                password,
                ssl_mode: s.ssl_mode,
                color: s.color,
            }
        })
        .collect()
}

/// Save a connection to disk. Password is stored in keyring separately.
pub fn save_connection(
    config: &ConnectionConfig,
    config_dir: Option<&Path>,
) -> Result<(), String> {
    let dir = config_dir
        .map(|p| p.to_path_buf())
        .unwrap_or_else(default_config_dir);
    ensure_dir(&dir)?;

    let mut connections = load_connections(Some(&dir));

    // Update or insert
    if let Some(existing) = connections.iter_mut().find(|c| c.id == config.id) {
        *existing = config.clone();
    } else {
        connections.push(config.clone());
    }

    // Store password in keyring
    if let Some(ref pw) = config.password {
        store_password(&config.id, pw);
    }

    // Write connections without passwords
    write_connections(&connections, &dir)
}

/// Delete a connection from disk and keyring.
pub fn delete_connection(id: &str, config_dir: Option<&Path>) -> Result<(), String> {
    let dir = config_dir
        .map(|p| p.to_path_buf())
        .unwrap_or_else(default_config_dir);

    let connections: Vec<ConnectionConfig> = load_connections(Some(&dir))
        .into_iter()
        .filter(|c| c.id != id)
        .collect();

    delete_password(id);
    write_connections(&connections, &dir)
}

/// Reorder connections by a list of IDs.
pub fn reorder_connections(ids: &[String], config_dir: Option<&Path>) -> Result<(), String> {
    let dir = config_dir
        .map(|p| p.to_path_buf())
        .unwrap_or_else(default_config_dir);

    let all = load_connections(Some(&dir));
    let mut ordered: Vec<ConnectionConfig> = Vec::with_capacity(ids.len());

    for id in ids {
        if let Some(conn) = all.iter().find(|c| &c.id == id) {
            ordered.push(conn.clone());
        }
    }

    write_connections(&ordered, &dir)
}

fn write_connections(connections: &[ConnectionConfig], dir: &Path) -> Result<(), String> {
    ensure_dir(dir)?;

    let stored: Vec<StoredConnection> = connections
        .iter()
        .map(|c| StoredConnection {
            id: c.id.clone(),
            name: c.name.clone(),
            driver_type: c.driver_type.clone(),
            host: c.host.clone(),
            port: c.port,
            database: c.database.clone(),
            username: c.username.clone(),
            ssl_mode: c.ssl_mode.clone(),
            color: c.color.clone(),
        })
        .collect();

    let json =
        serde_json::to_string_pretty(&stored).map_err(|e| format!("JSON serialize error: {e}"))?;
    fs::write(config_file(dir), json).map_err(|e| format!("File write error: {e}"))
}

// Keyring helpers — passwords are stored per connection ID

// Keyring is skipped in test mode to avoid macOS authorization prompts
// and hanging. Passwords are only persisted via keyring in production.

#[cfg(not(test))]
fn keyring_entry(connection_id: &str) -> Option<keyring::Entry> {
    keyring::Entry::new("com.ftfw.ferret", connection_id).ok()
}

#[cfg(not(test))]
fn load_password(connection_id: &str) -> Option<String> {
    keyring_entry(connection_id)
        .and_then(|entry| entry.get_password().ok())
}

#[cfg(not(test))]
fn store_password(connection_id: &str, password: &str) {
    if let Some(entry) = keyring_entry(connection_id) {
        let _ = entry.set_password(password);
    }
}

#[cfg(not(test))]
fn delete_password(connection_id: &str) {
    if let Some(entry) = keyring_entry(connection_id) {
        let _ = entry.delete_credential();
    }
}

#[cfg(test)]
fn load_password(_connection_id: &str) -> Option<String> {
    None
}

#[cfg(test)]
fn store_password(_connection_id: &str, _password: &str) {}

#[cfg(test)]
fn delete_password(_connection_id: &str) {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::types::*;
    use tempfile::TempDir;

    fn test_config(id: &str, name: &str) -> ConnectionConfig {
        ConnectionConfig {
            id: id.to_string(),
            name: name.to_string(),
            driver_type: DriverType::Postgresql,
            host: "localhost".to_string(),
            port: 5432,
            database: "testdb".to_string(),
            username: "testuser".to_string(),
            password: Some("testpass".to_string()),
            ssl_mode: SslMode::Disable,
            color: None,
        }
    }

    #[test]
    fn test_save_and_load_connection() {
        let dir = TempDir::new().unwrap();
        let config = test_config("c1", "Local Dev");

        save_connection(&config, Some(dir.path())).unwrap();

        let loaded = load_connections(Some(dir.path()));
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "c1");
        assert_eq!(loaded[0].name, "Local Dev");
        assert_eq!(loaded[0].host, "localhost");
        assert_eq!(loaded[0].port, 5432);
        // Password is NOT loaded from file (it goes to keyring which we skip in tests)
    }

    #[test]
    fn test_save_multiple_connections() {
        let dir = TempDir::new().unwrap();

        save_connection(&test_config("c1", "First"), Some(dir.path())).unwrap();
        save_connection(&test_config("c2", "Second"), Some(dir.path())).unwrap();

        let loaded = load_connections(Some(dir.path()));
        assert_eq!(loaded.len(), 2);
    }

    #[test]
    fn test_update_existing_connection() {
        let dir = TempDir::new().unwrap();

        save_connection(&test_config("c1", "Original"), Some(dir.path())).unwrap();

        let mut updated = test_config("c1", "Updated");
        updated.database = "newdb".to_string();
        save_connection(&updated, Some(dir.path())).unwrap();

        let loaded = load_connections(Some(dir.path()));
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].name, "Updated");
        assert_eq!(loaded[0].database, "newdb");
    }

    #[test]
    fn test_delete_connection() {
        let dir = TempDir::new().unwrap();

        save_connection(&test_config("c1", "First"), Some(dir.path())).unwrap();
        save_connection(&test_config("c2", "Second"), Some(dir.path())).unwrap();

        delete_connection("c1", Some(dir.path())).unwrap();

        let loaded = load_connections(Some(dir.path()));
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "c2");
    }

    #[test]
    fn test_reorder_connections() {
        let dir = TempDir::new().unwrap();

        save_connection(&test_config("c1", "First"), Some(dir.path())).unwrap();
        save_connection(&test_config("c2", "Second"), Some(dir.path())).unwrap();
        save_connection(&test_config("c3", "Third"), Some(dir.path())).unwrap();

        reorder_connections(
            &["c3".to_string(), "c1".to_string(), "c2".to_string()],
            Some(dir.path()),
        )
        .unwrap();

        let loaded = load_connections(Some(dir.path()));
        assert_eq!(loaded.len(), 3);
        assert_eq!(loaded[0].id, "c3");
        assert_eq!(loaded[1].id, "c1");
        assert_eq!(loaded[2].id, "c2");
    }

    #[test]
    fn test_load_empty_dir() {
        let dir = TempDir::new().unwrap();
        let loaded = load_connections(Some(dir.path()));
        assert!(loaded.is_empty());
    }

    #[test]
    fn test_load_corrupt_file() {
        let dir = TempDir::new().unwrap();
        fs::write(config_file(dir.path()), "not valid json").unwrap();
        let loaded = load_connections(Some(dir.path()));
        assert!(loaded.is_empty());
    }

    #[test]
    fn test_password_not_in_file() {
        let dir = TempDir::new().unwrap();
        save_connection(&test_config("c1", "Test"), Some(dir.path())).unwrap();

        let file_content = fs::read_to_string(config_file(dir.path())).unwrap();
        assert!(!file_content.contains("testpass"), "Password should not be stored in JSON file");
    }
}
