use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DriverType {
    Postgresql,
    Mysql,
    Sqlite,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SslMode {
    Disable,
    Require,
    Prefer,
    #[serde(rename = "verify-ca")]
    VerifyCa,
    #[serde(rename = "verify-full")]
    VerifyFull,
}

impl Default for SslMode {
    fn default() -> Self {
        Self::Disable
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TunnelType {
    Kubectl,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelConfig {
    #[serde(rename = "type")]
    pub tunnel_type: TunnelType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kube_context: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kube_namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kube_resource: Option<String>,
    pub local_port: u16,
    pub remote_port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub driver_type: DriverType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default)]
    pub ssl_mode: SslMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tunnel: Option<TunnelConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    pub id: String,
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ColumnCategory {
    Number,
    String,
    Date,
    Boolean,
    Json,
    Binary,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub category: ColumnCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<serde_json::Value>,
    pub row_count: usize,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaInfo {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub name: String,
    pub schema: String,
    #[serde(rename = "type")]
    pub table_type: String,
    pub row_count_estimate: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDetail {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    pub ordinal_position: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_config_serialization() {
        let config = ConnectionConfig {
            id: "test-id".to_string(),
            name: "Local Dev".to_string(),
            driver_type: DriverType::Postgresql,
            host: "localhost".to_string(),
            port: 5432,
            database: "mydb".to_string(),
            username: "postgres".to_string(),
            password: Some("secret".to_string()),
            ssl_mode: SslMode::Disable,
            color: None,
            tunnel: None,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ConnectionConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "test-id");
        assert_eq!(deserialized.name, "Local Dev");
        assert_eq!(deserialized.port, 5432);
        assert_eq!(deserialized.driver_type, DriverType::Postgresql);
    }

    #[test]
    fn test_connection_config_camel_case() {
        let config = ConnectionConfig {
            id: "1".to_string(),
            name: "test".to_string(),
            driver_type: DriverType::Postgresql,
            host: "localhost".to_string(),
            port: 5432,
            database: "db".to_string(),
            username: "user".to_string(),
            password: None,
            ssl_mode: SslMode::VerifyFull,
            color: None,
            tunnel: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("driverType"));
        assert!(json.contains("sslMode"));
        assert!(json.contains("verify-full"));
        // password is None, should be skipped
        assert!(!json.contains("password"));
    }

    #[test]
    fn test_ssl_mode_serialization() {
        let modes = vec![
            (SslMode::Disable, "\"disable\""),
            (SslMode::Require, "\"require\""),
            (SslMode::Prefer, "\"prefer\""),
            (SslMode::VerifyCa, "\"verify-ca\""),
            (SslMode::VerifyFull, "\"verify-full\""),
        ];
        for (mode, expected) in modes {
            let json = serde_json::to_string(&mode).unwrap();
            assert_eq!(json, expected);
            let deserialized: SslMode = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, mode);
        }
    }

    #[test]
    fn test_column_category_serialization() {
        let categories = vec![
            (ColumnCategory::Number, "\"number\""),
            (ColumnCategory::String, "\"string\""),
            (ColumnCategory::Date, "\"date\""),
            (ColumnCategory::Boolean, "\"boolean\""),
            (ColumnCategory::Json, "\"json\""),
            (ColumnCategory::Binary, "\"binary\""),
            (ColumnCategory::Other, "\"other\""),
        ];
        for (cat, expected) in categories {
            let json = serde_json::to_string(&cat).unwrap();
            assert_eq!(json, expected);
        }
    }

    #[test]
    fn test_query_result_with_error() {
        let result = QueryResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            duration_ms: 5,
            error: Some("relation does not exist".to_string()),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"error\""));
        assert!(json.contains("durationMs"));
    }

    #[test]
    fn test_query_result_without_error() {
        let result = QueryResult {
            columns: vec![ColumnInfo {
                name: "id".to_string(),
                data_type: "int4".to_string(),
                category: ColumnCategory::Number,
            }],
            rows: vec![serde_json::json!({"id": 1})],
            row_count: 1,
            duration_ms: 12,
            error: None,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(!json.contains("\"error\""));
        assert!(json.contains("rowCount"));
    }

    #[test]
    fn test_connection_status_serialization() {
        let status = ConnectionStatus {
            id: "conn-1".to_string(),
            connected: true,
            server_version: Some("PostgreSQL 16.2".to_string()),
            error: None,
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("serverVersion"));
        assert!(!json.contains("\"error\""));
    }
}
