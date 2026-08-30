use std::{
    fs,
    fs::OpenOptions,
    process::Command,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Deserialize;
use tauri::{AppHandle, Manager};
use thiserror::Error;

use crate::{
    installer,
    model::{
        AddControlSourceInput, CatalogAddon, CatalogReport, ControlSource, PermissionReport,
        SourceTestReport,
    },
};

const SOURCE_FILE: &str = "control-sources.json";
const OFFICIAL_SOURCE_ID: &str = "official";
const OFFICIAL_SOURCE_URL: &str = "https://huzhengxi.github.io/wps-addon-catalog/v1/index.json";

#[derive(Debug, Error)]
pub enum CatalogError {
    #[error("控件源地址必须是有效的 HTTPS URL。")]
    InvalidUrl,
    #[error("控件源名称不能为空，且最多 80 个字符。")]
    InvalidName,
    #[error("未找到指定控件源。")]
    SourceNotFound,
    #[error("无法读取控件源配置：{0}")]
    Storage(#[from] std::io::Error),
    #[error("控件源配置格式无效：{0}")]
    StorageFormat(#[from] serde_json::Error),
    #[error("无法连接控件源：{0}")]
    Network(#[from] reqwest::Error),
    #[error("控件源索引格式无效：{0}")]
    Index(String),
    #[error("环境检查失败：{0}")]
    Environment(String),
    #[error("无法打开系统权限设置：{0}")]
    Settings(std::io::Error),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceIndex {
    schema_version: u32,
    #[serde(default)]
    addons: Vec<CatalogAddon>,
}

fn default_sources() -> Vec<ControlSource> {
    vec![ControlSource {
        id: OFFICIAL_SOURCE_ID.into(),
        name: "官方控件源".into(),
        index_url: OFFICIAL_SOURCE_URL.into(),
        enabled: true,
        default_source: true,
        last_synced_at: None,
    }]
}

fn storage_path(app: &AppHandle) -> Result<std::path::PathBuf, CatalogError> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| CatalogError::Environment(error.to_string()))?;
    fs::create_dir_all(&directory)?;
    Ok(directory.join(SOURCE_FILE))
}

fn load_sources(app: &AppHandle) -> Result<Vec<ControlSource>, CatalogError> {
    let path = storage_path(app)?;
    match fs::read_to_string(&path) {
        Ok(content) => {
            let sources: Vec<ControlSource> = serde_json::from_str(&content)?;
            if sources.iter().any(|source| source.id == OFFICIAL_SOURCE_ID && source.default_source) {
                Ok(sources)
            } else {
                let mut sources = sources;
                sources.insert(0, default_sources().remove(0));
                save_sources(app, &sources)?;
                Ok(sources)
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let sources = default_sources();
            save_sources(app, &sources)?;
            Ok(sources)
        }
        Err(error) => Err(CatalogError::Storage(error)),
    }
}

fn save_sources(app: &AppHandle, sources: &[ControlSource]) -> Result<(), CatalogError> {
    let path = storage_path(app)?;
    let temporary = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(sources)?;
    fs::write(&temporary, text)?;
    fs::rename(temporary, path)?;
    Ok(())
}

fn validate_url(value: &str) -> Result<(), CatalogError> {
    let value = value.trim();
    if value.len() > 2048 || !value.starts_with("https://") || value.chars().any(char::is_whitespace) {
        return Err(CatalogError::InvalidUrl);
    }
    Ok(())
}

fn source_by_id<'a>(sources: &'a [ControlSource], id: &str) -> Result<&'a ControlSource, CatalogError> {
    sources.iter().find(|source| source.id == id).ok_or(CatalogError::SourceNotFound)
}

fn fetch_index(url: &str) -> Result<SourceIndex, CatalogError> {
    validate_url(url)?;
    let response = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()?
        .get(url)
        .send()?
        .error_for_status()?;
    let index: SourceIndex = response.json()?;
    if index.schema_version != 1 {
        return Err(CatalogError::Index("仅支持 schemaVersion: 1。".into()));
    }
    if index.addons.len() > 500 {
        return Err(CatalogError::Index("单个控件源最多包含 500 个插件。".into()));
    }
    for addon in &index.addons {
        validate_addon(addon)?;
    }
    Ok(index)
}

fn valid_token(value: &str, max_length: usize) -> bool {
    !value.is_empty()
        && value.len() <= max_length
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
}

fn validate_addon(addon: &CatalogAddon) -> Result<(), CatalogError> {
    if !valid_token(&addon.id, 80) || !valid_token(&addon.version, 80) {
        return Err(CatalogError::Index("插件 ID 和版本只能使用字母、数字、点、连字符或下划线。".into()));
    }
    if addon.name.trim().is_empty() || addon.name.chars().count() > 120 {
        return Err(CatalogError::Index("插件名称不能为空，且最多 120 个字符。".into()));
    }
    if addon.addon_type != "et" {
        return Err(CatalogError::Index("首版仅支持 type 为 et 的 WPS 表格插件。".into()));
    }
    validate_url(&addon.download_url)?;
    if addon.size == 0 || addon.size > 256 * 1024 * 1024 {
        return Err(CatalogError::Index("插件包大小必须在 1 B 到 256 MB 之间。".into()));
    }
    if addon.sha256.len() != 64 || !addon.sha256.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(CatalogError::Index("插件包必须提供 64 位 SHA-256 校验值。".into()));
    }
    Ok(())
}

pub fn list_sources(app: &AppHandle) -> Result<Vec<ControlSource>, CatalogError> {
    load_sources(app)
}

pub fn add_source(app: &AppHandle, input: AddControlSourceInput) -> Result<ControlSource, CatalogError> {
    let name = input.name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err(CatalogError::InvalidName);
    }
    validate_url(&input.index_url)?;
    let mut sources = load_sources(app)?;
    if sources.iter().any(|source| source.index_url == input.index_url.trim()) {
        return Err(CatalogError::Index("该控件源已存在。".into()));
    }
    let source = ControlSource {
        id: format!(
            "custom-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()
        ),
        name: name.to_owned(),
        index_url: input.index_url.trim().to_owned(),
        enabled: false,
        default_source: false,
        last_synced_at: None,
    };
    sources.push(source.clone());
    save_sources(app, &sources)?;
    Ok(source)
}

pub fn set_source_enabled(app: &AppHandle, id: &str, enabled: bool) -> Result<Vec<ControlSource>, CatalogError> {
    let mut sources = load_sources(app)?;
    let source = sources.iter_mut().find(|source| source.id == id).ok_or(CatalogError::SourceNotFound)?;
    source.enabled = enabled;
    save_sources(app, &sources)?;
    Ok(sources)
}

pub fn test_source(app: &AppHandle, id: &str) -> Result<SourceTestReport, CatalogError> {
    let mut sources = load_sources(app)?;
    let source = source_by_id(&sources, id)?;
    let index = fetch_index(&source.index_url)?;
    if let Some(source) = sources.iter_mut().find(|source| source.id == id) {
        source.last_synced_at = Some("刚刚验证".into());
    }
    save_sources(app, &sources)?;
    Ok(SourceTestReport {
        reachable: true,
        addon_count: Some(index.addons.len()),
        message: "连接成功，索引格式有效。".into(),
    })
}

/// Reads every enabled source. A broken custom source is isolated to a warning
/// so it cannot hide plugins offered by the remaining sources.
pub fn list_catalog_addons(app: &AppHandle) -> Result<CatalogReport, CatalogError> {
    let sources = load_sources(app)?;
    let mut addons = Vec::new();
    let mut warnings = Vec::new();

    for source in sources.into_iter().filter(|source| source.enabled) {
        match fetch_index(&source.index_url) {
            Ok(index) => {
                for mut addon in index.addons {
                    if addons.iter().any(|existing: &CatalogAddon| existing.id == addon.id) {
                        warnings.push(format!("已忽略控件源“{}”中与更高优先级来源重名的插件“{}”。", source.name, addon.name));
                        continue;
                    }
                    addon.source_id = source.id.clone();
                    addon.source_name = source.name.clone();
                    addons.push(addon);
                }
            }
            Err(error) => warnings.push(format!("控件源“{}”无法同步：{}", source.name, error)),
        }
    }

    Ok(CatalogReport { addons, warnings })
}

pub fn resolve_catalog_addon(
    app: &AppHandle,
    source_id: &str,
    addon_id: &str,
) -> Result<CatalogAddon, CatalogError> {
    let sources = load_sources(app)?;
    let source = source_by_id(&sources, source_id)?;
    if !source.enabled {
        return Err(CatalogError::Index("控件源已停用，不能安装其中的插件。".into()));
    }
    let mut addon = fetch_index(&source.index_url)?
        .addons
        .into_iter()
        .find(|addon| addon.id == addon_id)
        .ok_or_else(|| CatalogError::Index("控件源中未找到指定插件。".into()))?;
    addon.source_id = source.id.clone();
    addon.source_name = source.name.clone();
    Ok(addon)
}

pub fn inspect_permissions(_app: &AppHandle) -> Result<PermissionReport, CatalogError> {
    let (wps_found, wps_path_readable, paths) =
        installer::permission_target().map_err(|error| CatalogError::Environment(error.to_string()))?;
    let jsaddons_path = paths.jsaddons_dir.display().to_string();
    let jsaddons_writable = check_jsaddons_write_access(&paths);
    let guidance = if jsaddons_writable {
        "WPS 加载项目录可读写，安装时仍会再次验证写入权限。".into()
    } else if cfg!(target_os = "macos") {
        "请在系统设置 → 隐私与安全性 → 文件与文件夹中允许访问；若仍失败，请在完全磁盘访问权限中加入本应用。".into()
    } else {
        "请检查 Windows 文件系统访问或受控文件夹访问设置，然后重新检测。".into()
    };
    Ok(PermissionReport {
        wps_found,
        wps_path_readable,
        jsaddons_writable,
        jsaddons_path,
        guidance,
    })
}

/// Verifies the exact access required for installation. The add-on directory
/// is created when missing (the installer does this as well), then a uniquely
/// named empty file is created and immediately removed. This avoids treating a
/// readable-but-not-writable directory as an approved permission state.
fn check_jsaddons_write_access(paths: &installer::paths::InstallPaths) -> bool {
    if paths.ensure_jsaddons_dir().is_err() {
        return false;
    }
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let file_name = format!(".wps-addon-manager-permission-{nonce}");
    let Ok(probe) = paths.checked_child(&file_name) else {
        return false;
    };
    let Ok(file) = OpenOptions::new().write(true).create_new(true).open(&probe) else {
        return false;
    };
    drop(file);
    fs::remove_file(probe).is_ok()
}

pub fn open_permission_settings() -> Result<(), CatalogError> {
    #[cfg(target_os = "macos")]
    let result = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
        .spawn();
    #[cfg(target_os = "windows")]
    let result = Command::new("cmd")
        .args(["/C", "start", "", "ms-settings:privacy-broadfilesystemaccess"])
        .spawn();
    result.map(|_| ()).map_err(CatalogError::Settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_url_must_be_https_without_whitespace() {
        assert!(validate_url("https://example.com/index.json").is_ok());
        assert!(validate_url("http://example.com/index.json").is_err());
        assert!(validate_url("https://example.com/a b").is_err());
    }

    #[test]
    fn catalog_addon_requires_safe_download_metadata() {
        let addon = CatalogAddon {
            id: "date-picker".into(),
            name: "日期选择器".into(),
            addon_type: "et".into(),
            version: "1.0.1".into(),
            description: String::new(),
            platforms: vec!["macos".into()],
            download_url: "https://example.com/date-picker.7z".into(),
            sha256: "a".repeat(64),
            size: 1,
            published_at: None,
            release_notes: None,
            source_id: String::new(),
            source_name: String::new(),
        };
        assert!(validate_addon(&addon).is_ok());
    }
}
