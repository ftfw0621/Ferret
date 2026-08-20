use std::collections::{HashMap, HashSet};
use std::time::Instant;

use async_trait::async_trait;
use tokio::sync::RwLock;

use super::driver::DatabaseDriver;
use super::types::*;

/// A mock database driver for testing.
/// Stores predefined responses and tracks connection state.
pub struct MockDriver {
    connect_response: RwLock<ConnectionStatus>,
    query_responses: RwLock<HashMap<String, QueryResult>>,
    default_query_result: RwLock<Option<QueryResult>>,
    schemas: RwLock<Vec<SchemaInfo>>,
    tables: RwLock<HashMap<String, Vec<TableInfo>>>,
    columns: RwLock<HashMap<String, Vec<ColumnDetail>>>,
    connected: RwLock<HashSet<String>>,
}

impl MockDriver {
    pub fn new() -> Self {
        Self {
            connect_response: RwLock::new(ConnectionStatus {
                id: String::new(),
                connected: true,
                server_version: Some("MockDB 1.0".to_string()),
                error: None,
            }),
            query_responses: RwLock::new(HashMap::new()),
            default_query_result: RwLock::new(None),
            schemas: RwLock::new(vec![]),
            tables: RwLock::new(HashMap::new()),
            columns: RwLock::new(HashMap::new()),
            connected: RwLock::new(HashSet::new()),
        }
    }

    /// Set the response that `connect` will return.
    pub async fn with_connect_response(self, status: ConnectionStatus) -> Self {
        *self.connect_response.write().await = status;
        self
    }

    /// Set a response for a specific SQL query.
    pub async fn with_query_response(self, sql: &str, result: QueryResult) -> Self {
        self.query_responses
            .write()
            .await
            .insert(sql.to_string(), result);
        self
    }

    /// Set a default response for any query that doesn't match a specific one.
    pub async fn with_default_query_result(self, result: QueryResult) -> Self {
        *self.default_query_result.write().await = Some(result);
        self
    }

    /// Set the schemas that `get_schemas` will return.
    pub async fn with_schemas(self, schemas: Vec<SchemaInfo>) -> Self {
        *self.schemas.write().await = schemas;
        self
    }

    /// Set the tables for a specific schema.
    pub async fn with_tables(self, schema: &str, tables: Vec<TableInfo>) -> Self {
        self.tables
            .write()
            .await
            .insert(schema.to_string(), tables);
        self
    }

    /// Set the columns for a specific schema.table.
    pub async fn with_columns(self, schema: &str, table: &str, cols: Vec<ColumnDetail>) -> Self {
        self.columns
            .write()
            .await
            .insert(format!("{schema}.{table}"), cols);
        self
    }
}

#[async_trait]
impl DatabaseDriver for MockDriver {
    async fn connect(&self, config: &ConnectionConfig) -> ConnectionStatus {
        let template = self.connect_response.read().await;
        let status = ConnectionStatus {
            id: config.id.clone(),
            connected: template.connected,
            server_version: template.server_version.clone(),
            error: template.error.clone(),
        };
        if status.connected {
            self.connected.write().await.insert(config.id.clone());
        }
        status
    }

    async fn disconnect(&self, connection_id: &str) {
        self.connected.write().await.remove(connection_id);
    }

    async fn test_connection(&self, config: &ConnectionConfig) -> Result<String, String> {
        let status = self.connect(config).await;
        if status.connected {
            self.disconnect(&config.id).await;
            Ok(status.server_version.unwrap_or_default())
        } else {
            Err(status.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    async fn execute_query(&self, connection_id: &str, sql: &str) -> QueryResult {
        if !self.connected.read().await.contains(connection_id) {
            return QueryResult {
                columns: vec![],
                rows: vec![],
                row_count: 0,
                duration_ms: 0,
                error: Some("Not connected".to_string()),
            };
        }

        let start = Instant::now();

        // Check for a specific query response first
        if let Some(result) = self.query_responses.read().await.get(sql) {
            let mut r = result.clone();
            r.duration_ms = start.elapsed().as_millis() as u64;
            return r;
        }

        // Fall back to default
        if let Some(result) = self.default_query_result.read().await.as_ref() {
            let mut r = result.clone();
            r.duration_ms = start.elapsed().as_millis() as u64;
            return r;
        }

        QueryResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            duration_ms: start.elapsed().as_millis() as u64,
            error: Some(format!("No mock response for query: {sql}")),
        }
    }

    async fn get_schemas(&self, connection_id: &str) -> Result<Vec<SchemaInfo>, String> {
        if !self.connected.read().await.contains(connection_id) {
            return Err("Not connected".to_string());
        }
        Ok(self.schemas.read().await.clone())
    }

    async fn get_tables(&self, connection_id: &str, schema: &str) -> Result<Vec<TableInfo>, String> {
        if !self.connected.read().await.contains(connection_id) {
            return Err("Not connected".to_string());
        }
        Ok(self
            .tables
            .read()
            .await
            .get(schema)
            .cloned()
            .unwrap_or_default())
    }

    async fn get_columns(
        &self,
        connection_id: &str,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnDetail>, String> {
        if !self.connected.read().await.contains(connection_id) {
            return Err("Not connected".to_string());
        }
        let key = format!("{schema}.{table}");
        Ok(self
            .columns
            .read()
            .await
            .get(&key)
            .cloned()
            .unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_config(id: &str) -> ConnectionConfig {
        ConnectionConfig {
            id: id.to_string(),
            name: "test".to_string(),
            driver_type: DriverType::Postgresql,
            host: "localhost".to_string(),
            port: 5432,
            database: "testdb".to_string(),
            username: "user".to_string(),
            password: None,
            ssl_mode: SslMode::Disable,
            color: None,
        }
    }

    fn make_query_result(cols: Vec<(&str, &str, ColumnCategory)>, rows: Vec<serde_json::Value>) -> QueryResult {
        QueryResult {
            columns: cols
                .into_iter()
                .map(|(name, dt, cat)| ColumnInfo {
                    name: name.to_string(),
                    data_type: dt.to_string(),
                    category: cat,
                })
                .collect(),
            row_count: rows.len(),
            rows,
            duration_ms: 0,
            error: None,
        }
    }

    // ── 1. connect and query ──

    #[tokio::test]
    async fn connect_and_query() {
        let driver = MockDriver::new()
            .with_query_response(
                "SELECT 1",
                make_query_result(
                    vec![("?column?", "int4", ColumnCategory::Number)],
                    vec![serde_json::json!({"?column?": 1})],
                ),
            )
            .await;

        let config = make_config("c1");
        let status = driver.connect(&config).await;
        assert!(status.connected);
        assert_eq!(status.id, "c1");
        assert!(status.server_version.is_some());

        let result = driver.execute_query("c1", "SELECT 1").await;
        assert!(result.error.is_none());
        assert_eq!(result.row_count, 1);
        assert_eq!(result.columns.len(), 1);
        assert_eq!(result.columns[0].name, "?column?");
        assert_eq!(result.columns[0].data_type, "int4");
        assert_eq!(result.columns[0].category, ColumnCategory::Number);
    }

    // ── 2. disconnect removes connection ──

    #[tokio::test]
    async fn disconnect_removes_connection() {
        let driver = MockDriver::new()
            .with_default_query_result(make_query_result(vec![], vec![]))
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;
        let r1 = driver.execute_query("c1", "SELECT 1").await;
        assert!(r1.error.is_none());

        driver.disconnect("c1").await;
        let r2 = driver.execute_query("c1", "SELECT 1").await;
        assert_eq!(r2.error, Some("Not connected".to_string()));
    }

    // ── 3. query not connected ──

    #[tokio::test]
    async fn query_not_connected() {
        let driver = MockDriver::new();
        let result = driver.execute_query("nonexistent", "SELECT 1").await;
        assert_eq!(result.error, Some("Not connected".to_string()));
        assert_eq!(result.row_count, 0);
        assert!(result.columns.is_empty());
    }

    // ── 4. query with columns and types ──

    #[tokio::test]
    async fn query_with_columns_and_types() {
        let driver = MockDriver::new()
            .with_query_response(
                "SELECT id, name, active FROM users",
                make_query_result(
                    vec![
                        ("id", "int4", ColumnCategory::Number),
                        ("name", "text", ColumnCategory::String),
                        ("active", "bool", ColumnCategory::Boolean),
                    ],
                    vec![serde_json::json!({"id": 1, "name": "Alice", "active": true})],
                ),
            )
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;

        let result = driver.execute_query("c1", "SELECT id, name, active FROM users").await;
        assert_eq!(result.columns.len(), 3);
        assert_eq!(result.columns[0].category, ColumnCategory::Number);
        assert_eq!(result.columns[1].category, ColumnCategory::String);
        assert_eq!(result.columns[2].category, ColumnCategory::Boolean);
        assert_eq!(result.rows[0]["name"], "Alice");
        assert_eq!(result.rows[0]["active"], true);
    }

    // ── 5. get schemas ──

    #[tokio::test]
    async fn get_schemas_returns_expected() {
        let driver = MockDriver::new()
            .with_schemas(vec![
                SchemaInfo { name: "public".to_string() },
                SchemaInfo { name: "auth".to_string() },
            ])
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;

        let schemas = driver.get_schemas("c1").await.unwrap();
        assert_eq!(schemas.len(), 2);
        assert_eq!(schemas[0].name, "public");
        assert_eq!(schemas[1].name, "auth");
    }

    // ── 6. get tables ──

    #[tokio::test]
    async fn get_tables_returns_expected() {
        let driver = MockDriver::new()
            .with_tables(
                "public",
                vec![
                    TableInfo {
                        name: "users".to_string(),
                        schema: "public".to_string(),
                        table_type: "table".to_string(),
                        row_count_estimate: 12400,
                        comment: Some("User accounts".to_string()),
                    },
                    TableInfo {
                        name: "active_users_v".to_string(),
                        schema: "public".to_string(),
                        table_type: "view".to_string(),
                        row_count_estimate: 0,
                        comment: None,
                    },
                ],
            )
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;

        let tables = driver.get_tables("c1", "public").await.unwrap();
        assert_eq!(tables.len(), 2);
        assert_eq!(tables[0].name, "users");
        assert_eq!(tables[0].table_type, "table");
        assert_eq!(tables[0].row_count_estimate, 12400);
        assert_eq!(tables[0].comment, Some("User accounts".to_string()));
        assert_eq!(tables[1].table_type, "view");
        assert!(tables[1].comment.is_none());
    }

    // ── 7. get columns ──

    #[tokio::test]
    async fn get_columns_returns_expected() {
        let driver = MockDriver::new()
            .with_columns(
                "public",
                "users",
                vec![
                    ColumnDetail {
                        name: "id".to_string(),
                        data_type: "int8".to_string(),
                        nullable: false,
                        default_value: Some("nextval('users_id_seq')".to_string()),
                        is_primary_key: true,
                        comment: Some("Primary key".to_string()),
                        ordinal_position: 1,
                    },
                    ColumnDetail {
                        name: "email".to_string(),
                        data_type: "varchar".to_string(),
                        nullable: false,
                        default_value: None,
                        is_primary_key: false,
                        comment: None,
                        ordinal_position: 2,
                    },
                    ColumnDetail {
                        name: "bio".to_string(),
                        data_type: "text".to_string(),
                        nullable: true,
                        default_value: None,
                        is_primary_key: false,
                        comment: None,
                        ordinal_position: 3,
                    },
                ],
            )
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;

        let cols = driver.get_columns("c1", "public", "users").await.unwrap();
        assert_eq!(cols.len(), 3);
        assert_eq!(cols[0].name, "id");
        assert!(cols[0].is_primary_key);
        assert!(!cols[0].nullable);
        assert_eq!(cols[0].default_value, Some("nextval('users_id_seq')".to_string()));
        assert!(!cols[1].is_primary_key);
        assert!(!cols[1].nullable);
        assert!(cols[2].nullable);
    }

    // ── 8. execute query with error ──

    #[tokio::test]
    async fn execute_query_with_error() {
        let driver = MockDriver::new()
            .with_query_response(
                "SELECT * FROM nonexistent",
                QueryResult {
                    columns: vec![],
                    rows: vec![],
                    row_count: 0,
                    duration_ms: 0,
                    error: Some("relation \"nonexistent\" does not exist".to_string()),
                },
            )
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;

        let result = driver.execute_query("c1", "SELECT * FROM nonexistent").await;
        assert!(result.error.is_some());
        assert!(result.error.unwrap().contains("nonexistent"));
    }

    // ── 9. multiple connections ──

    #[tokio::test]
    async fn multiple_connections() {
        let driver = MockDriver::new()
            .with_default_query_result(make_query_result(
                vec![("x", "int4", ColumnCategory::Number)],
                vec![serde_json::json!({"x": 42})],
            ))
            .await;

        let c1 = make_config("conn-1");
        let c2 = make_config("conn-2");

        driver.connect(&c1).await;
        driver.connect(&c2).await;

        // Both connected
        let r1 = driver.execute_query("conn-1", "SELECT 1").await;
        let r2 = driver.execute_query("conn-2", "SELECT 1").await;
        assert!(r1.error.is_none());
        assert!(r2.error.is_none());

        // Disconnect one
        driver.disconnect("conn-1").await;
        let r1 = driver.execute_query("conn-1", "SELECT 1").await;
        let r2 = driver.execute_query("conn-2", "SELECT 1").await;
        assert_eq!(r1.error, Some("Not connected".to_string()));
        assert!(r2.error.is_none());
    }

    // ── 10. empty result ──

    #[tokio::test]
    async fn empty_result() {
        let driver = MockDriver::new()
            .with_query_response(
                "SELECT * FROM empty_table",
                make_query_result(
                    vec![("id", "int4", ColumnCategory::Number)],
                    vec![],
                ),
            )
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;

        let result = driver.execute_query("c1", "SELECT * FROM empty_table").await;
        assert!(result.error.is_none());
        assert_eq!(result.row_count, 0);
        assert_eq!(result.columns.len(), 1);
        assert!(result.rows.is_empty());
    }

    // ── 11. connect failure ──

    #[tokio::test]
    async fn connect_failure() {
        let driver = MockDriver::new()
            .with_connect_response(ConnectionStatus {
                id: String::new(),
                connected: false,
                server_version: None,
                error: Some("Connection refused".to_string()),
            })
            .await;

        let config = make_config("c1");
        let status = driver.connect(&config).await;
        assert!(!status.connected);
        assert_eq!(status.error, Some("Connection refused".to_string()));

        // Querying after failed connect should give "Not connected"
        let result = driver.execute_query("c1", "SELECT 1").await;
        assert_eq!(result.error, Some("Not connected".to_string()));
    }

    // ── 12. test_connection success ──

    #[tokio::test]
    async fn test_connection_success() {
        let driver = MockDriver::new();
        let config = make_config("c1");
        let version = driver.test_connection(&config).await.unwrap();
        assert_eq!(version, "MockDB 1.0");

        // After test_connection, should be disconnected (cleanup)
        let result = driver.execute_query("c1", "SELECT 1").await;
        assert_eq!(result.error, Some("Not connected".to_string()));
    }

    // ── 13. test_connection failure ──

    #[tokio::test]
    async fn test_connection_failure() {
        let driver = MockDriver::new()
            .with_connect_response(ConnectionStatus {
                id: String::new(),
                connected: false,
                server_version: None,
                error: Some("auth failed".to_string()),
            })
            .await;

        let config = make_config("c1");
        let err = driver.test_connection(&config).await.unwrap_err();
        assert_eq!(err, "auth failed");
    }

    // ── 14. get_schemas not connected ──

    #[tokio::test]
    async fn get_schemas_not_connected() {
        let driver = MockDriver::new();
        let err = driver.get_schemas("nope").await.unwrap_err();
        assert_eq!(err, "Not connected");
    }

    // ── 15. get_tables not connected ──

    #[tokio::test]
    async fn get_tables_not_connected() {
        let driver = MockDriver::new();
        let err = driver.get_tables("nope", "public").await.unwrap_err();
        assert_eq!(err, "Not connected");
    }

    // ── 16. get_columns not connected ──

    #[tokio::test]
    async fn get_columns_not_connected() {
        let driver = MockDriver::new();
        let err = driver.get_columns("nope", "public", "users").await.unwrap_err();
        assert_eq!(err, "Not connected");
    }

    // ── 17. no mock response gives error ──

    #[tokio::test]
    async fn no_mock_response_gives_error() {
        let driver = MockDriver::new();
        let config = make_config("c1");
        driver.connect(&config).await;

        let result = driver.execute_query("c1", "SELECT something_unmocked").await;
        assert!(result.error.is_some());
        assert!(result.error.unwrap().contains("No mock response"));
    }

    // ── 18. default query result fallback ──

    #[tokio::test]
    async fn default_query_result_fallback() {
        let driver = MockDriver::new()
            .with_query_response("SELECT specific", make_query_result(vec![], vec![]))
            .await
            .with_default_query_result(make_query_result(
                vec![("x", "text", ColumnCategory::String)],
                vec![serde_json::json!({"x": "default"})],
            ))
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;

        // Specific match
        let r1 = driver.execute_query("c1", "SELECT specific").await;
        assert!(r1.error.is_none());
        assert_eq!(r1.row_count, 0);

        // Falls back to default
        let r2 = driver.execute_query("c1", "SELECT anything").await;
        assert!(r2.error.is_none());
        assert_eq!(r2.row_count, 1);
        assert_eq!(r2.rows[0]["x"], "default");
    }

    // ── 19. get_tables for unknown schema returns empty ──

    #[tokio::test]
    async fn get_tables_unknown_schema_returns_empty() {
        let driver = MockDriver::new()
            .with_tables("public", vec![TableInfo {
                name: "t".to_string(),
                schema: "public".to_string(),
                table_type: "table".to_string(),
                row_count_estimate: 0,
                comment: None,
            }])
            .await;

        let config = make_config("c1");
        driver.connect(&config).await;

        let tables = driver.get_tables("c1", "nonexistent").await.unwrap();
        assert!(tables.is_empty());
    }

    // ── 20. get_columns for unknown table returns empty ──

    #[tokio::test]
    async fn get_columns_unknown_table_returns_empty() {
        let driver = MockDriver::new();
        let config = make_config("c1");
        driver.connect(&config).await;

        let cols = driver.get_columns("c1", "public", "nonexistent").await.unwrap();
        assert!(cols.is_empty());
    }
}
