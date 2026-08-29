use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallationStatus {
    NotInstalled,
    Installed,
    Partial,
    PayloadInvalid,
    Unsupported,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentReport {
    pub architecture: String,
    pub addon_version: String,
    pub install_status: InstallationStatus,
    pub wps_installed: bool,
    pub wps_running: bool,
    pub wps_version: Option<String>,
    pub wps_version_supported: bool,
    pub wps_minimum_version: String,
    pub js_addons_path: String,
    pub payload_valid: bool,
    pub addon_directory_exists: bool,
    pub publish_entry_matches: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationReport {
    pub action: String,
    pub message: String,
    pub restart_attempted: bool,
    pub restart_succeeded: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateReport {
    pub current_version: String,
    pub update: Option<AppUpdateInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}
