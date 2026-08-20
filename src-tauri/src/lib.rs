mod commands;
pub mod db;

use db::driver::DatabaseDriver;
use db::postgres::PostgresDriver;
use tokio::sync::Mutex;

pub struct AppState {
    pub driver: Mutex<Box<dyn DatabaseDriver>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            driver: Mutex::new(Box::new(PostgresDriver::new())),
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_connections,
            commands::save_connection,
            commands::delete_connection,
            commands::reorder_connections,
            commands::connect_db,
            commands::disconnect_db,
            commands::test_connection,
            commands::execute_query,
            commands::cancel_query,
            commands::get_schemas,
            commands::get_tables,
            commands::get_columns,
            commands::parse_connection_url,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
