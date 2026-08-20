use tauri::State;

use crate::db::connection_store;
use crate::db::postgres;
use crate::db::types::*;
use crate::AppState;

#[tauri::command]
pub async fn list_connections() -> Vec<ConnectionConfig> {
    connection_store::load_connections(None)
}

#[tauri::command]
pub async fn save_connection(
    config: ConnectionConfig,
) -> Result<(), String> {
    connection_store::save_connection(&config, None)
}

#[tauri::command]
pub async fn delete_connection(id: String) -> Result<(), String> {
    connection_store::delete_connection(&id, None)
}

#[tauri::command]
pub async fn reorder_connections(ids: Vec<String>) -> Result<(), String> {
    connection_store::reorder_connections(&ids, None)
}

#[tauri::command]
pub async fn connect_db(
    state: State<'_, AppState>,
    config: ConnectionConfig,
) -> Result<ConnectionStatus, String> {
    let driver = state.driver.lock().await;
    Ok(driver.connect(&config).await)
}

#[tauri::command]
pub async fn disconnect_db(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<(), String> {
    let driver = state.driver.lock().await;
    driver.disconnect(&connection_id).await;
    Ok(())
}

#[tauri::command]
pub async fn test_connection(
    state: State<'_, AppState>,
    config: ConnectionConfig,
) -> Result<String, String> {
    let driver = state.driver.lock().await;
    driver.test_connection(&config).await
}

#[tauri::command]
pub async fn execute_query(
    state: State<'_, AppState>,
    connection_id: String,
    sql: String,
) -> Result<QueryResult, String> {
    let driver = state.driver.lock().await;
    Ok(driver.execute_query(&connection_id, &sql).await)
}

#[tauri::command]
pub async fn cancel_query() -> Result<(), String> {
    // TODO: implement query cancellation
    Ok(())
}

#[tauri::command]
pub async fn get_schemas(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<Vec<SchemaInfo>, String> {
    let driver = state.driver.lock().await;
    driver.get_schemas(&connection_id).await
}

#[tauri::command]
pub async fn get_tables(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
) -> Result<Vec<TableInfo>, String> {
    let driver = state.driver.lock().await;
    driver.get_tables(&connection_id, &schema).await
}

#[tauri::command]
pub async fn get_columns(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<Vec<ColumnDetail>, String> {
    let driver = state.driver.lock().await;
    driver.get_columns(&connection_id, &schema, &table).await
}

#[tauri::command]
pub fn parse_connection_url(url: String) -> Result<ConnectionConfig, String> {
    postgres::parse_connection_string(&url)
}
