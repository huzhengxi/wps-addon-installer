use tauri::AppHandle;

use crate::{
    catalog,
    installer,
    model::{
        AddControlSourceInput, AppUpdateReport, ControlSource, EnvironmentReport, OperationReport,
        PermissionReport, SourceTestReport,
    },
    updater,
};

fn command_error(error: installer::InstallerError) -> String {
    error.to_string()
}

#[tauri::command]
pub fn list_control_sources(app: AppHandle) -> Result<Vec<ControlSource>, String> {
    catalog::list_sources(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn add_control_source(
    app: AppHandle,
    input: AddControlSourceInput,
) -> Result<ControlSource, String> {
    catalog::add_source(&app, input).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_control_source_enabled(
    app: AppHandle,
    id: String,
    enabled: bool,
) -> Result<Vec<ControlSource>, String> {
    catalog::set_source_enabled(&app, &id, enabled).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn test_control_source(app: AppHandle, id: String) -> Result<SourceTestReport, String> {
    catalog::test_source(&app, &id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn inspect_permissions(app: AppHandle) -> Result<PermissionReport, String> {
    catalog::inspect_permissions(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_permission_settings() -> Result<(), String> {
    catalog::open_permission_settings().map_err(|error| error.to_string())
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

#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<AppUpdateReport, String> {
    updater::check(app).await
}

#[tauri::command]
pub async fn install_app_update_and_restart(app: AppHandle) -> Result<bool, String> {
    updater::install_and_restart(app).await
}
