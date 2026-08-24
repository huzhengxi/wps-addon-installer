use tauri::AppHandle;

use crate::{
    installer,
    model::{EnvironmentReport, OperationReport},
};

fn command_error(error: installer::InstallerError) -> String {
    error.to_string()
}

#[tauri::command]
pub fn inspect_environment(app: AppHandle) -> Result<EnvironmentReport, String> {
    installer::inspect(&app).map_err(command_error)
}

#[tauri::command]
pub fn install_addon(app: AppHandle) -> Result<OperationReport, String> {
    installer::install(&app).map_err(command_error)
}

#[tauri::command]
pub fn uninstall_addon(app: AppHandle) -> Result<OperationReport, String> {
    installer::uninstall(&app).map_err(command_error)
}

#[tauri::command]
pub fn restart_wps(app: AppHandle) -> Result<OperationReport, String> {
    installer::restart_only(&app).map_err(command_error)
}
