mod commands;
mod log_watcher;
mod state;

use state::AppState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(AppState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state.clone())
        .setup(move |app| {
            // Restore config from disk
            commands::config::initialize(&app.handle(), &app_state);

            // Kick off the stats emission loop
            commands::stats::spawn_stats_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_config,
            commands::config::pick_server_folder,
            commands::config::set_max_ram,
            commands::config::set_tunnel_address,
            commands::server::get_server_status,
            commands::server::get_players,
            commands::server::start_server,
            commands::server::stop_server,
            commands::server::send_command,
            commands::properties::read_server_properties,
            commands::properties::write_server_properties,
            commands::properties::restart_server,
            commands::mods::list_mods,
            commands::mods::toggle_mod,
            commands::mods::open_mods_folder,
            commands::network::get_network_info,
            commands::network::get_active_network_profile,
            commands::network::apply_network_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
