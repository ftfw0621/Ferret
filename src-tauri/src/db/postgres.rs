use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use deadpool_postgres::{Config, Pool, Runtime};
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use tokio::sync::RwLock;
use tokio_postgres::NoTls;

use super::driver::DatabaseDriver;
use super::types::*;

pub struct PostgresDriver {
    pools: Arc<RwLock<HashMap<String, Pool>>>,
}

impl PostgresDriver {
    pub fn new() -> Self {
        Self {
            pools: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait]
impl DatabaseDriver for PostgresDriver {
    async fn connect(&self, config: &ConnectionConfig) -> ConnectionStatus {
        let mut pg_config = Config::new();
        pg_config.host = Some(config.host.clone());
        pg_config.port = Some(config.port);
        pg_config.dbname = Some(config.database.clone());
        pg_config.user = Some(config.username.clone());
        pg_config.password = config.password.clone();

        let pool_result = match config.ssl_mode {
            SslMode::Disable => pg_config.create_pool(Some(Runtime::Tokio1), NoTls),
            _ => {
                let tls_connector = match TlsConnector::builder()
                    .danger_accept_invalid_certs(
                        !matches!(config.ssl_mode, SslMode::VerifyFull | SslMode::VerifyCa),
                    )
                    .build()
                {
                    Ok(c) => c,
                    Err(e) => {
                        return ConnectionStatus {
                            id: config.id.clone(),
                            connected: false,
                            server_version: None,
                            error: Some(format!("TLS error: {e}")),
                        };
                    }
                };
                let connector = MakeTlsConnector::new(tls_connector);
                pg_config.create_pool(Some(Runtime::Tokio1), connector)
            }
        };

        let pool = match pool_result {
            Ok(p) => p,
            Err(e) => {
                return ConnectionStatus {
                    id: config.id.clone(),
                    connected: false,
                    server_version: None,
                    error: Some(format!("Pool error: {e}")),
                };
            }
        };

        // Test the connection and get server version
        match pool.get().await {
            Ok(client) => match client.query_one("SELECT version()", &[]).await {
                Ok(row) => {
                    let version: String = row.get(0);
                    self.pools.write().await.insert(config.id.clone(), pool);
                    ConnectionStatus {
                        id: config.id.clone(),
                        connected: true,
                        server_version: Some(version),
                        error: None,
                    }
                }
                Err(e) => ConnectionStatus {
                    id: config.id.clone(),
                    connected: false,
                    server_version: None,
                    error: Some(format!("Query error: {e}")),
                },
            },
            Err(e) => {
                // Dig into the error chain to find the actual cause
                let mut msg = format!("{e}");
                let mut source: Option<&dyn std::error::Error> = std::error::Error::source(&e);
                while let Some(cause) = source {
                    msg = format!("{msg}: {cause}");
                    source = std::error::Error::source(cause);
                }
                ConnectionStatus {
                id: config.id.clone(),
                connected: false,
                server_version: None,
                error: Some(msg),
            }
            },
        }
    }

    async fn disconnect(&self, connection_id: &str) {
        self.pools.write().await.remove(connection_id);
    }

    async fn test_connection(
        &self,
        config: &ConnectionConfig,
    ) -> Result<String, String> {
        let status = self.connect(config).await;
        if status.connected {
            // Clean up the test pool
            self.disconnect(&config.id).await;
            Ok(status.server_version.unwrap_or_default())
        } else {
            Err(status.error.unwrap_or_else(|| "Unknown error".to_string()))
        }
    }

    async fn execute_query(
        &self,
        connection_id: &str,
        sql: &str,
    ) -> QueryResult {
        let pools = self.pools.read().await;
        let pool = match pools.get(connection_id) {
            Some(p) => p,
            None => {
                return QueryResult {
                    columns: vec![],
                    rows: vec![],
                    row_count: 0,
                    duration_ms: 0,
                    error: Some("Not connected".to_string()),
                };
            }
        };

        let start = Instant::now();

        let client = match pool.get().await {
            Ok(c) => c,
            Err(e) => {
                return QueryResult {
                    columns: vec![],
                    rows: vec![],
                    row_count: 0,
                    duration_ms: start.elapsed().as_millis() as u64,
                    error: Some(format!("Connection error: {e}")),
                };
            }
        };

        // Use prepare + query so we get column info even with 0 rows
        let stmt = match client.prepare(sql).await {
            Ok(s) => s,
            Err(e) => {
                return QueryResult {
                    columns: vec![],
                    rows: vec![],
                    row_count: 0,
                    duration_ms: start.elapsed().as_millis() as u64,
                    error: Some(e.to_string()),
                };
            }
        };

        // Extract columns from the prepared statement (available even with 0 rows)
        let columns: Vec<ColumnInfo> = stmt
            .columns()
            .iter()
            .map(|col| {
                let oid = col.type_().oid();
                ColumnInfo {
                    name: col.name().to_string(),
                    data_type: oid_to_type_name(oid),
                    category: oid_to_category(oid),
                }
            })
            .collect();

        match client.query(&stmt, &[]).await {
            Ok(rows) => {
                let duration_ms = start.elapsed().as_millis() as u64;

                let json_rows: Vec<serde_json::Value> = rows
                    .iter()
                    .map(|row| {
                        let mut map = serde_json::Map::new();
                        for (i, col) in row.columns().iter().enumerate() {
                            let oid = col.type_().oid();
                            let value = row_value_to_json(row, i, oid);
                            map.insert(col.name().to_string(), value);
                        }
                        serde_json::Value::Object(map)
                    })
                    .collect();

                let row_count = json_rows.len();

                QueryResult {
                    columns,
                    rows: json_rows,
                    row_count,
                    duration_ms,
                    error: None,
                }
            }
            Err(e) => QueryResult {
                columns: vec![],
                rows: vec![],
                row_count: 0,
                duration_ms: start.elapsed().as_millis() as u64,
                error: Some(e.to_string()),
            },
        }
    }

    async fn get_schemas(&self, connection_id: &str) -> Result<Vec<SchemaInfo>, String> {
        let result = self
            .execute_query(
                connection_id,
                "SELECT schema_name FROM information_schema.schemata \
                 WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') \
                 ORDER BY schema_name",
            )
            .await;

        if let Some(err) = result.error {
            return Err(err);
        }

        Ok(result
            .rows
            .iter()
            .filter_map(|row| {
                row.get("schema_name")
                    .and_then(|v| v.as_str())
                    .map(|name| SchemaInfo {
                        name: name.to_string(),
                    })
            })
            .collect())
    }

    async fn get_tables(
        &self,
        connection_id: &str,
        schema: &str,
    ) -> Result<Vec<TableInfo>, String> {
        let sql = format!(
            "SELECT \
                t.table_name, \
                t.table_type, \
                COALESCE( \
                    (SELECT reltuples::bigint FROM pg_class c \
                     JOIN pg_namespace n ON n.oid = c.relnamespace \
                     WHERE c.relname = t.table_name AND n.nspname = t.table_schema), \
                    0 \
                ) AS row_estimate, \
                obj_description( \
                    (SELECT c.oid FROM pg_class c \
                     JOIN pg_namespace n ON n.oid = c.relnamespace \
                     WHERE c.relname = t.table_name AND n.nspname = t.table_schema), \
                    'pg_class' \
                ) AS table_comment \
            FROM information_schema.tables t \
            WHERE t.table_schema = '{schema}' \
                AND t.table_type IN ('BASE TABLE', 'VIEW') \
            ORDER BY t.table_type, t.table_name"
        );

        let result = self.execute_query(connection_id, &sql).await;
        if let Some(err) = result.error {
            return Err(err);
        }

        Ok(result
            .rows
            .iter()
            .filter_map(|row| {
                let name = row.get("table_name")?.as_str()?.to_string();
                let table_type = match row.get("table_type")?.as_str()? {
                    "VIEW" => "view",
                    _ => "table",
                };
                let row_estimate = row
                    .get("row_estimate")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let comment = row
                    .get("table_comment")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                Some(TableInfo {
                    name,
                    schema: schema.to_string(),
                    table_type: table_type.to_string(),
                    row_count_estimate: row_estimate,
                    comment,
                })
            })
            .collect())
    }

    async fn get_columns(
        &self,
        connection_id: &str,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnDetail>, String> {
        let sql = format!(
            "SELECT \
                c.column_name, \
                c.udt_name, \
                c.is_nullable, \
                c.column_default, \
                c.ordinal_position, \
                COALESCE( \
                    (SELECT true FROM information_schema.key_column_usage kcu \
                     JOIN information_schema.table_constraints tc \
                       ON tc.constraint_name = kcu.constraint_name \
                       AND tc.table_schema = kcu.table_schema \
                     WHERE tc.constraint_type = 'PRIMARY KEY' \
                       AND kcu.table_schema = c.table_schema \
                       AND kcu.table_name = c.table_name \
                       AND kcu.column_name = c.column_name), \
                    false \
                ) AS is_pk \
            FROM information_schema.columns c \
            WHERE c.table_schema = '{schema}' AND c.table_name = '{table}' \
            ORDER BY c.ordinal_position"
        );

        let result = self.execute_query(connection_id, &sql).await;
        if let Some(err) = result.error {
            return Err(err);
        }

        Ok(result
            .rows
            .iter()
            .filter_map(|row| {
                let name = row.get("column_name")?.as_str()?.to_string();
                let data_type = row.get("udt_name")?.as_str()?.to_string();
                let nullable = row.get("is_nullable")?.as_str()? == "YES";
                let default_value = row
                    .get("column_default")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let is_primary_key = row.get("is_pk").and_then(|v| v.as_bool()).unwrap_or(false);
                let ordinal_position = row
                    .get("ordinal_position")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32;

                Some(ColumnDetail {
                    name,
                    data_type,
                    nullable,
                    default_value,
                    is_primary_key,
                    comment: None,
                    ordinal_position,
                })
            })
            .collect())
    }
}

/// Extract a row value at a given column index to JSON based on OID
fn row_value_to_json(
    row: &tokio_postgres::Row,
    idx: usize,
    oid: u32,
) -> serde_json::Value {
    // Try typed extraction based on OID, falling back to string
    match oid {
        // bool
        16 => row
            .try_get::<_, Option<bool>>(idx)
            .ok()
            .flatten()
            .map(serde_json::Value::Bool)
            .unwrap_or(serde_json::Value::Null),
        // int2
        21 => row
            .try_get::<_, Option<i16>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        // int4
        23 => row
            .try_get::<_, Option<i32>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        // int8
        20 => row
            .try_get::<_, Option<i64>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::Number(v.into()))
            .unwrap_or(serde_json::Value::Null),
        // float4
        700 => row
            .try_get::<_, Option<f32>>(idx)
            .ok()
            .flatten()
            .and_then(|v| serde_json::Number::from_f64(v as f64))
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        // float8
        701 => row
            .try_get::<_, Option<f64>>(idx)
            .ok()
            .flatten()
            .and_then(|v| serde_json::Number::from_f64(v))
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        // json, jsonb
        114 | 3802 => row
            .try_get::<_, Option<serde_json::Value>>(idx)
            .ok()
            .flatten()
            .unwrap_or(serde_json::Value::Null),
        // uuid
        2950 => row
            .try_get::<_, Option<uuid::Uuid>>(idx)
            .ok()
            .flatten()
            .map(|v| serde_json::Value::String(v.to_string()))
            .unwrap_or(serde_json::Value::Null),
        // bytea
        17 => row
            .try_get::<_, Option<Vec<u8>>>(idx)
            .ok()
            .flatten()
            .map(|bytes| {
                let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
                let display = if hex.len() > 32 {
                    format!("\\x{}…", &hex[..32])
                } else {
                    format!("\\x{hex}")
                };
                serde_json::Value::String(display)
            })
            .unwrap_or(serde_json::Value::Null),
        // text, varchar, name, and everything else -> try as string
        _ => row
            .try_get::<_, Option<String>>(idx)
            .ok()
            .flatten()
            .map(serde_json::Value::String)
            .unwrap_or(serde_json::Value::Null),
    }
}

/// Map PostgreSQL OID to human-readable type name
pub fn oid_to_type_name(oid: u32) -> String {
    match oid {
        16 => "bool",
        17 => "bytea",
        20 => "int8",
        21 => "int2",
        23 => "int4",
        25 => "text",
        26 => "oid",
        114 => "json",
        142 => "xml",
        700 => "float4",
        701 => "float8",
        790 => "money",
        1042 => "bpchar",
        1043 => "varchar",
        1082 => "date",
        1083 => "time",
        1114 => "timestamp",
        1184 => "timestamptz",
        1186 => "interval",
        1266 => "timetz",
        1560 => "bit",
        1562 => "varbit",
        1700 => "numeric",
        2950 => "uuid",
        3802 => "jsonb",
        3904 => "int4range",
        3906 => "numrange",
        3908 => "tsrange",
        3910 => "tstzrange",
        3912 => "daterange",
        3926 => "int8range",
        _ => return format!("oid:{oid}"),
    }
    .to_string()
}

/// Map PostgreSQL OID to a broad category for UI cell rendering
pub fn oid_to_category(oid: u32) -> ColumnCategory {
    match oid {
        // Numbers
        20 | 21 | 23 | 26 | 700 | 701 | 790 | 1700 => ColumnCategory::Number,
        // Strings
        25 | 1042 | 1043 | 2950 | 142 | 1186 => ColumnCategory::String,
        // Dates/times
        1082 | 1083 | 1114 | 1184 | 1266 => ColumnCategory::Date,
        // Booleans
        16 => ColumnCategory::Boolean,
        // JSON
        114 | 3802 => ColumnCategory::Json,
        // Binary
        17 => ColumnCategory::Binary,
        // Everything else
        _ => ColumnCategory::Other,
    }
}

/// Parse a PostgreSQL connection string into a ConnectionConfig
pub fn parse_connection_string(url: &str) -> Result<ConnectionConfig, String> {
    // Format: postgresql://user:pass@host:port/dbname?sslmode=require
    let url = url.trim();
    let url = url
        .strip_prefix("postgresql://")
        .or_else(|| url.strip_prefix("postgres://"))
        .ok_or("URL must start with postgresql:// or postgres://")?;

    // Split at ? for query params
    let (main_part, query_part) = url.split_once('?').unwrap_or((url, ""));

    // Split userinfo@hostinfo/dbname
    let (userinfo, rest) = main_part
        .split_once('@')
        .ok_or("Missing @ separator between credentials and host")?;

    // Parse user:password
    let (username, password) = match userinfo.split_once(':') {
        Some((u, p)) => (
            urldecode(u),
            if p.is_empty() {
                None
            } else {
                Some(urldecode(p))
            },
        ),
        None => (urldecode(userinfo), None),
    };

    // Parse host:port/dbname
    let (hostport, database) = match rest.split_once('/') {
        Some((hp, db)) => (hp, if db.is_empty() { "postgres" } else { db }),
        None => (rest, "postgres"),
    };

    let (host, port) = match hostport.split_once(':') {
        Some((h, p)) => (
            h.to_string(),
            p.parse::<u16>().map_err(|_| "Invalid port number")?,
        ),
        None => (hostport.to_string(), 5432),
    };

    // Parse query params
    let mut ssl_mode = SslMode::Disable;
    for param in query_part.split('&') {
        if let Some((key, value)) = param.split_once('=') {
            if key == "sslmode" {
                ssl_mode = match value {
                    "require" => SslMode::Require,
                    "prefer" => SslMode::Prefer,
                    "verify-ca" => SslMode::VerifyCa,
                    "verify-full" => SslMode::VerifyFull,
                    _ => SslMode::Disable,
                };
            }
        }
    }

    Ok(ConnectionConfig {
        id: uuid::Uuid::new_v4().to_string(),
        name: String::new(),
        driver_type: DriverType::Postgresql,
        host,
        port,
        database: database.to_string(),
        username,
        password,
        ssl_mode,
        color: None,
    })
}

fn urldecode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let hi = chars.next().unwrap_or(b'0');
            let lo = chars.next().unwrap_or(b'0');
            let byte = u8::from_str_radix(
                &format!("{}{}", hi as char, lo as char),
                16,
            )
            .unwrap_or(b'?');
            result.push(byte as char);
        } else {
            result.push(b as char);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_oid_to_type_name_common_types() {
        assert_eq!(oid_to_type_name(16), "bool");
        assert_eq!(oid_to_type_name(17), "bytea");
        assert_eq!(oid_to_type_name(20), "int8");
        assert_eq!(oid_to_type_name(21), "int2");
        assert_eq!(oid_to_type_name(23), "int4");
        assert_eq!(oid_to_type_name(25), "text");
        assert_eq!(oid_to_type_name(114), "json");
        assert_eq!(oid_to_type_name(700), "float4");
        assert_eq!(oid_to_type_name(701), "float8");
        assert_eq!(oid_to_type_name(1043), "varchar");
        assert_eq!(oid_to_type_name(1082), "date");
        assert_eq!(oid_to_type_name(1114), "timestamp");
        assert_eq!(oid_to_type_name(1184), "timestamptz");
        assert_eq!(oid_to_type_name(1700), "numeric");
        assert_eq!(oid_to_type_name(2950), "uuid");
        assert_eq!(oid_to_type_name(3802), "jsonb");
    }

    #[test]
    fn test_oid_to_type_name_unknown() {
        assert_eq!(oid_to_type_name(99999), "oid:99999");
    }

    #[test]
    fn test_oid_to_category_numbers() {
        assert_eq!(oid_to_category(20), ColumnCategory::Number);
        assert_eq!(oid_to_category(21), ColumnCategory::Number);
        assert_eq!(oid_to_category(23), ColumnCategory::Number);
        assert_eq!(oid_to_category(700), ColumnCategory::Number);
        assert_eq!(oid_to_category(701), ColumnCategory::Number);
        assert_eq!(oid_to_category(1700), ColumnCategory::Number);
    }

    #[test]
    fn test_oid_to_category_strings() {
        assert_eq!(oid_to_category(25), ColumnCategory::String);
        assert_eq!(oid_to_category(1043), ColumnCategory::String);
        assert_eq!(oid_to_category(2950), ColumnCategory::String);
    }

    #[test]
    fn test_oid_to_category_dates() {
        assert_eq!(oid_to_category(1082), ColumnCategory::Date);
        assert_eq!(oid_to_category(1114), ColumnCategory::Date);
        assert_eq!(oid_to_category(1184), ColumnCategory::Date);
    }

    #[test]
    fn test_oid_to_category_special() {
        assert_eq!(oid_to_category(16), ColumnCategory::Boolean);
        assert_eq!(oid_to_category(114), ColumnCategory::Json);
        assert_eq!(oid_to_category(3802), ColumnCategory::Json);
        assert_eq!(oid_to_category(17), ColumnCategory::Binary);
        assert_eq!(oid_to_category(99999), ColumnCategory::Other);
    }

    #[test]
    fn test_parse_connection_string_basic() {
        let config =
            parse_connection_string("postgresql://postgres:secret@localhost:5432/mydb").unwrap();
        assert_eq!(config.host, "localhost");
        assert_eq!(config.port, 5432);
        assert_eq!(config.database, "mydb");
        assert_eq!(config.username, "postgres");
        assert_eq!(config.password, Some("secret".to_string()));
        assert_eq!(config.ssl_mode, SslMode::Disable);
        assert_eq!(config.driver_type, DriverType::Postgresql);
    }

    #[test]
    fn test_parse_connection_string_postgres_prefix() {
        let config =
            parse_connection_string("postgres://user:pass@db.example.com/prod").unwrap();
        assert_eq!(config.host, "db.example.com");
        assert_eq!(config.port, 5432); // default
        assert_eq!(config.database, "prod");
        assert_eq!(config.username, "user");
    }

    #[test]
    fn test_parse_connection_string_with_ssl() {
        let config = parse_connection_string(
            "postgresql://user:pass@host:5433/db?sslmode=require",
        )
        .unwrap();
        assert_eq!(config.port, 5433);
        assert_eq!(config.ssl_mode, SslMode::Require);
    }

    #[test]
    fn test_parse_connection_string_without_password() {
        let config =
            parse_connection_string("postgresql://admin@localhost/testdb").unwrap();
        assert_eq!(config.username, "admin");
        assert!(config.password.is_none());
        assert_eq!(config.database, "testdb");
    }

    #[test]
    fn test_parse_connection_string_special_chars() {
        let config =
            parse_connection_string("postgresql://user%40name:p%40ss%3Aword@localhost/db")
                .unwrap();
        assert_eq!(config.username, "user@name");
        assert_eq!(config.password, Some("p@ss:word".to_string()));
    }

    #[test]
    fn test_parse_connection_string_verify_full() {
        let config = parse_connection_string(
            "postgresql://u:p@h/d?sslmode=verify-full",
        )
        .unwrap();
        assert_eq!(config.ssl_mode, SslMode::VerifyFull);
    }

    #[test]
    fn test_parse_connection_string_invalid() {
        assert!(parse_connection_string("mysql://user:pass@host/db").is_err());
        assert!(parse_connection_string("not-a-url").is_err());
    }
}
