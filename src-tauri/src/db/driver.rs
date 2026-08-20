use async_trait::async_trait;
use super::types::*;

/// Abstract database driver interface.
/// PostgresDriver implements this for real databases;
/// MockDriver implements it for testing.
#[async_trait]
pub trait DatabaseDriver: Send + Sync {
    async fn connect(&self, config: &ConnectionConfig) -> ConnectionStatus;
    async fn disconnect(&self, connection_id: &str);
    async fn test_connection(&self, config: &ConnectionConfig) -> Result<String, String>;
    async fn execute_query(&self, connection_id: &str, sql: &str) -> QueryResult;
    async fn get_schemas(&self, connection_id: &str) -> Result<Vec<SchemaInfo>, String>;
    async fn get_tables(&self, connection_id: &str, schema: &str) -> Result<Vec<TableInfo>, String>;
    async fn get_columns(
        &self,
        connection_id: &str,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnDetail>, String>;
    async fn cancel_query(&self);
}
