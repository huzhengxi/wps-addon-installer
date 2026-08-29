mod catalog;
mod commands;
mod installer;
mod model;
mod updater;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::inspect_environment,
            commands::list_control_sources,
            commands::add_control_source,
            commands::set_control_source_enabled,
            commands::test_control_source,
            commands::inspect_permissions,
            commands::open_permission_settings,
            commands::install_addon,
            commands::uninstall_addon,
            commands::restart_wps,
            commands::check_app_update,
            commands::install_app_update_and_restart,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WPS addon installer");
}
