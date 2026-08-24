mod commands;
mod installer;
mod model;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::inspect_environment,
            commands::install_addon,
            commands::uninstall_addon,
            commands::restart_wps,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WPS addon installer");
}
