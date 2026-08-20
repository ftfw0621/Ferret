mod commands;
pub mod db;
mod tunnel;

use db::driver::DatabaseDriver;
use db::postgres::PostgresDriver;
use tokio::sync::Mutex;
use tauri::Manager;
use tunnel::TunnelManager;

pub struct AppState {
    pub driver: Mutex<Box<dyn DatabaseDriver>>,
    pub tunnel_manager: TunnelManager,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            app.manage(AppState {
                driver: Mutex::new(Box::new(PostgresDriver::new())),
                tunnel_manager: TunnelManager::new(app.handle().clone()),
            });
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
