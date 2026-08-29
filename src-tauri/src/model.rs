use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlSource {
    pub id: String,
    pub name: String,
    pub index_url: String,
    pub enabled: bool,
    pub default_source: bool,
    pub last_synced_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddControlSourceInput {
    pub name: String,
    pub index_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTestReport {
    pub reachable: bool,
    pub addon_count: Option<usize>,
    pub message: String,
}

/// A plugin entry supplied by a trusted control-source index.  The source
/// identity is added locally after the index is fetched; it is not trusted
/// from the remote document itself.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogAddon {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub addon_type: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub platforms: Vec<String>,
    pub download_url: String,
    pub sha256: String,
    pub size: u64,
    #[serde(default)]
    pub published_at: Option<String>,
    #[serde(default)]
    pub release_notes: Option<String>,
    #[serde(skip)]
    pub source_id: String,
    #[serde(skip)]
    pub source_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogReport {
    pub addons: Vec<CatalogAddon>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionReport {
    pub wps_found: bool,
    pub wps_path_readable: bool,
    pub jsaddons_writable: bool,
    pub jsaddons_path: String,
    pub guidance: String,
}

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
