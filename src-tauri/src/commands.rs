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
pub async fn install_addon(app: AppHandle) -> Result<OperationReport, String> {
    tauri::async_runtime::spawn_blocking(move || installer::install(&app))
        .await
        .map_err(|error| format!("安装后台任务执行失败：{error}"))?
        .map_err(command_error)
}

#[tauri::command]
pub async fn uninstall_addon(app: AppHandle) -> Result<OperationReport, String> {
    tauri::async_runtime::spawn_blocking(move || installer::uninstall(&app))
        .await
        .map_err(|error| format!("卸载后台任务执行失败：{error}"))?
        .map_err(command_error)
}

#[tauri::command]
pub fn restart_wps(app: AppHandle) -> Result<OperationReport, String> {
    installer::restart_only(&app).map_err(command_error)
}
