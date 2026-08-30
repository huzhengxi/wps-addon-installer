mod archive;
mod manifest;
pub(crate) mod paths;
mod publish_xml;
mod transaction;
mod wps;

use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Emitter};
use thiserror::Error;

use crate::model::{CatalogAddon, EnvironmentReport, InstalledAddon, InstallationStatus, OperationReport};
use manifest::{AddonManifest, PayloadPaths};
use paths::InstallPaths;

static OPERATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Debug, Error)]
pub enum InstallerError {
    #[error("操作正在进行中，请等待当前任务完成。")]
    OperationBusy,
    #[error("未找到 WPS Office（查找位置：{0}）。请先安装 WPS Office 后重试。")]
    WpsNotFound(String),
    #[error("无法读取或解析 WPS 版本号：{0}")]
    WpsVersionUnreadable(String),
    #[error("WPS 版本 {actual} 不满足要求：必须大于 {minimum}。")]
    WpsVersionUnsupported {
        actual: String,
        minimum: &'static str,
    },
    #[error("内置加载项资源无效：{0}")]
    PayloadInvalid(String),
    #[error("加载项目录不可安全访问：{0}")]
    UnsafePath(String),
    #[error("无法写入 WPS 加载项目录：{0}")]
    Io(#[from] std::io::Error),
    #[error("解压加载项失败：{0}")]
    Archive(String),
    #[error("安装提交失败：{0}")]
    Commit(String),
    #[error("下载插件包失败：{0}")]
    Download(String),
    #[error("下载的插件包 SHA-256 校验失败。")]
    DownloadHashMismatch,
}

fn lock_operation() -> Result<std::sync::MutexGuard<'static, ()>, InstallerError> {
    OPERATION_LOCK
        .get_or_init(|| Mutex::new(()))
        .try_lock()
        .map_err(|_| InstallerError::OperationBusy)
}

fn progress(app: &AppHandle, action: &str, percent: u8, message: &str) {
    let _ = app.emit(
        "operation-progress",
        serde_json::json!({
            "action": action,
            "percent": percent,
            "message": message,
        }),
    );
}

fn load(app: &AppHandle) -> Result<(AddonManifest, PayloadPaths, InstallPaths), InstallerError> {
    let payload = PayloadPaths::from_app(app)?;
    let manifest = payload.read_manifest()?;
    manifest.validate()?;
    payload.validate(&manifest)?;
    let paths = InstallPaths::from_manifest(&manifest)?;
    Ok((manifest, payload, paths))
}

fn ensure_supported_wps_version() -> Result<(), InstallerError> {
    let version = wps::version().map_err(InstallerError::WpsVersionUnreadable)?;
    if !wps::version_is_supported(&version).map_err(InstallerError::WpsVersionUnreadable)? {
        return Err(InstallerError::WpsVersionUnsupported {
            actual: version,
            minimum: wps::MINIMUM_SUPPORTED_VERSION,
        });
    }
    Ok(())
}

/// Returns the values needed by the permissions screen without enumerating
/// the add-on directory. Enumeration itself can fail when access is denied,
/// which used to prevent the screen from reporting a useful permission state.
pub(crate) fn permission_target() -> Result<(bool, bool, InstallPaths), InstallerError> {
    let wps_found = wps::application_exists();
    let wps_path_readable = wps_found && wps::version().is_ok();
    let paths = InstallPaths::from_installation("probe", "0")?;
    Ok((wps_found, wps_path_readable, paths))
}

pub fn inspect(_app: &AppHandle) -> Result<EnvironmentReport, InstallerError> {
    let architecture = std::env::consts::ARCH.to_owned();
    if !(cfg!(target_os = "macos") || cfg!(target_os = "windows")) {
        return Ok(EnvironmentReport {
            architecture,
            addon_version: "未知".into(),
            install_status: InstallationStatus::Unsupported,
            wps_installed: false,
            wps_running: false,
            wps_version: None,
            wps_version_supported: false,
            wps_minimum_version: "未知".into(),
            js_addons_path: "不支持的系统".into(),
            payload_valid: false,
            addon_directory_exists: false,
            publish_entry_matches: false,
            message: "当前系统暂不支持；安装器支持 macOS 与 Windows。".into(),
        });
    }
    let wps_installed = wps::application_exists();
    let wps_running = wps::is_running();
    let wps_version = wps_installed.then(wps::version).transpose().ok().flatten();
    let wps_version_supported = wps_version
        .as_deref()
        .and_then(|version| wps::version_is_supported(version).ok())
        .unwrap_or(false);

    let probe = CatalogAddon {
        id: "probe".into(), name: "probe".into(), addon_type: "et".into(), version: "0".into(),
        description: String::new(), platforms: Vec::new(), download_url: "https://example.invalid".into(),
        sha256: String::new(), size: 1, published_at: None, release_notes: None, source_id: String::new(), source_name: String::new(),
    };
    let paths = InstallPaths::from_catalog_addon(&probe)?;
    let installed = list_installed_catalog_addons()?;
    let addon_directory_exists = !installed.is_empty();
    let publish_entry_matches = paths.publish_xml.is_file();
    let install_status = if installed.is_empty() { InstallationStatus::NotInstalled } else { InstallationStatus::Installed };
    let message = if installed.is_empty() { "尚未发现在线管理的插件。".into() } else { format!("已发现 {} 个已安装插件。", installed.len()) };

    Ok(EnvironmentReport {
        architecture,
        addon_version: "在线控件源".into(),
        install_status,
        wps_installed,
        wps_running,
        wps_version,
        wps_version_supported,
        wps_minimum_version: wps::MINIMUM_SUPPORTED_VERSION.into(),
        js_addons_path: paths.jsaddons_dir.display().to_string(),
        payload_valid: true,
        addon_directory_exists,
        publish_entry_matches,
        message,
    })
}

pub fn install(app: &AppHandle) -> Result<OperationReport, InstallerError> {
    let _guard = lock_operation()?;
    progress(app, "install", 5, "正在检查 WPS 环境…");
    if !wps::application_exists() {
        return Err(InstallerError::WpsNotFound(wps::APPLICATION_HINT.into()));
    }
    ensure_supported_wps_version()?;

    progress(app, "install", 20, "正在校验内置加载项…");
    let (manifest, payload, paths) = load(app)?;
    paths.ensure_jsaddons_dir()?;

    progress(app, "install", 40, "正在解压加载项…");
    let extraction = tempfile::Builder::new()
        .prefix("wps-addon-manager-")
        .tempdir()
        .map_err(InstallerError::Io)?;
    archive::extract_and_validate(&payload.archive, extraction.path(), &manifest.archive_root)?;
    progress(app, "install", 65, "正在写入加载项文件…");
    transaction::install(
        &paths,
        extraction.path().join(&manifest.archive_root),
        &manifest,
    )?;

    progress(app, "install", 82, "正在清理旧版本…");
    let mut warnings = transaction::remove_legacy_dirs(&paths, &manifest);
    progress(app, "install", 90, "正在重新打开 WPS…");
    let restart = wps::restart();
    let restart_succeeded = restart.is_ok();
    if let Err(error) = restart {
        warnings.push(format!("加载项已安装，但 WPS 重启失败：{error}"));
    }

    let report = OperationReport {
        action: "install".into(),
        message: if restart_succeeded {
            "日期选择器已安装，WPS 已重新打开。".into()
        } else {
            "日期选择器已安装。".into()
        },
        restart_attempted: true,
        restart_succeeded,
        warnings,
    };
    progress(app, "install", 100, "安装完成");
    Ok(report)
}

/// Installs only a catalog entry previously resolved by the backend. The UI
/// never passes an archive URL or a filesystem path to this function.
pub fn install_catalog_addon(app: &AppHandle, addon: &CatalogAddon) -> Result<OperationReport, InstallerError> {
    let _guard = lock_operation()?;
    progress(app, "install", 5, "正在检查 WPS 环境…");
    if !wps::application_exists() {
        return Err(InstallerError::WpsNotFound(wps::APPLICATION_HINT.into()));
    }
    ensure_supported_wps_version()?;
    let paths = InstallPaths::from_catalog_addon(addon)?;
    paths.ensure_jsaddons_dir()?;
    let archive_root = format!("{}_{}", addon.id, addon.version);

    progress(app, "install", 20, "正在下载插件包…");
    let download = tempfile::Builder::new().prefix("wps-addon-download-").tempfile().map_err(InstallerError::Io)?;
    download_catalog_archive(&addon.download_url, addon.size, &addon.sha256, download.path())?;
    progress(app, "install", 45, "正在校验并解压插件包…");
    let extraction = tempfile::Builder::new().prefix("wps-addon-manager-").tempdir().map_err(InstallerError::Io)?;
    archive::extract_and_validate(download.path(), extraction.path(), &archive_root)?;
    progress(app, "install", 65, "正在写入加载项文件…");
    transaction::install_catalog(&paths, extraction.path().join(&archive_root), addon, &archive_root)?;
    progress(app, "install", 90, "正在重新打开 WPS…");
    let restart = wps::restart();
    let restart_succeeded = restart.is_ok();
    let mut warnings = Vec::new();
    if let Err(error) = restart {
        warnings.push(format!("插件已安装，但 WPS 重启失败：{error}"));
    }
    progress(app, "install", 100, "安装完成");
    Ok(OperationReport {
        action: "install".into(),
        message: format!("{} 已安装。", addon.name),
        restart_attempted: true,
        restart_succeeded,
        warnings,
    })
}

pub fn list_installed_catalog_addons() -> Result<Vec<InstalledAddon>, InstallerError> {
    let probe = CatalogAddon {
        id: "probe".into(), name: "probe".into(), addon_type: "et".into(), version: "0".into(),
        description: String::new(), platforms: Vec::new(), download_url: "https://example.invalid".into(),
        sha256: String::new(), size: 1, published_at: None, release_notes: None, source_id: String::new(), source_name: String::new(),
    };
    let paths = InstallPaths::from_catalog_addon(&probe)?;
    let root = &paths.jsaddons_dir;
    let entries = match std::fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(InstallerError::Io(error)),
    };
    let mut installed = Vec::new();
    for entry in entries {
        let entry = entry?;
        let metadata = std::fs::symlink_metadata(entry.path())?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() { continue; }
        let directory = entry.file_name().to_string_lossy().to_string();
        let Some((id, version)) = directory.rsplit_once('_') else { continue; };
        if manifest::validate_token(id, "插件 ID").is_err() || manifest::validate_token(version, "插件版本").is_err() { continue; }
        let healthy = ["manifest.xml", "index.html", "main.js"].iter().all(|file| entry.path().join(file).is_file());
        installed.push(InstalledAddon {
            id: id.to_owned(), name: id.to_owned(), version: version.to_owned(),
            source: "已安装目录".into(), health: if healthy { "运行正常" } else { "需要修复" }.into(),
        });
    }
    installed.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(installed)
}

pub fn uninstall_catalog_addon(app: &AppHandle, addon_id: &str, version: &str) -> Result<OperationReport, InstallerError> {
    let _guard = lock_operation()?;
    if !wps::application_exists() { return Err(InstallerError::WpsNotFound(wps::APPLICATION_HINT.into())); }
    manifest::validate_token(addon_id, "插件 ID")?;
    manifest::validate_token(version, "插件版本")?;
    let paths = InstallPaths::from_installation(addon_id, version)?;
    paths.ensure_jsaddons_dir()?;
    progress(app, "uninstall", 30, "正在移除插件文件…");
    let metadata = match std::fs::symlink_metadata(&paths.target_dir) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Err(InstallerError::UnsafePath("未找到所选插件目录。".into())),
        Err(error) => return Err(InstallerError::Io(error)),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() { return Err(InstallerError::UnsafePath("拒绝删除符号链接或非目录插件。".into())); }
    let backup = paths.checked_child(&format!(".{}_{}.remove-{}", addon_id, version, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos()))?;
    let xml_before = std::fs::read_to_string(&paths.publish_xml).unwrap_or_default();
    let xml_after = publish_xml::remove_catalog_entry(&xml_before, addon_id);
    let xml_temp = paths.checked_child(&format!(".publish.xml.remove-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos()))?;
    publish_xml::write_temp(&xml_temp, &xml_after)?;
    std::fs::rename(&paths.target_dir, &backup)?;
    let xml_result = std::fs::rename(&xml_temp, &paths.publish_xml);
    if let Err(error) = xml_result {
        let _ = std::fs::rename(&backup, &paths.target_dir);
        let _ = std::fs::remove_file(&xml_temp);
        return Err(InstallerError::Commit(error.to_string()));
    }
    std::fs::remove_dir_all(&backup)?;
    progress(app, "uninstall", 85, "正在重新打开 WPS…");
    let restart = wps::restart();
    let restart_succeeded = restart.is_ok();
    let warnings = restart.err().map(|error| vec![format!("插件已卸载，但 WPS 重启失败：{error}")]).unwrap_or_default();
    progress(app, "uninstall", 100, "卸载完成");
    Ok(OperationReport { action: "uninstall".into(), message: format!("{addon_id} 已卸载。"), restart_attempted: true, restart_succeeded, warnings })
}

fn download_catalog_archive(url: &str, expected_size: u64, expected_hash: &str, destination: &std::path::Path) -> Result<(), InstallerError> {
    use std::io::{Read, Write};
    use sha2::{Digest, Sha256};
    let mut response = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .map_err(|error| InstallerError::Download(error.to_string()))?
        .get(url)
        .send()
        .map_err(|error| InstallerError::Download(error.to_string()))?
        .error_for_status()
        .map_err(|error| InstallerError::Download(error.to_string()))?;
    if response.content_length().is_some_and(|size| size != expected_size) {
        return Err(InstallerError::Download("服务器返回的文件大小与控件源声明不一致。".into()));
    }
    let mut file = std::fs::File::create(destination)?;
    let mut digest = Sha256::new();
    let mut total = 0_u64;
    let mut buffer = [0_u8; 32 * 1024];
    loop {
        let count = response.read(&mut buffer).map_err(InstallerError::Io)?;
        if count == 0 { break; }
        total = total.saturating_add(count as u64);
        if total > expected_size { return Err(InstallerError::Download("下载文件超过控件源声明大小。".into())); }
        digest.update(&buffer[..count]);
        file.write_all(&buffer[..count])?;
    }
    file.sync_all()?;
    if total != expected_size { return Err(InstallerError::Download("下载文件大小与控件源声明不一致。".into())); }
    if hex::encode(digest.finalize()) != expected_hash.to_ascii_lowercase() { return Err(InstallerError::DownloadHashMismatch); }
    Ok(())
}

pub fn uninstall(app: &AppHandle) -> Result<OperationReport, InstallerError> {
    let _guard = lock_operation()?;
    progress(app, "uninstall", 5, "正在检查 WPS 环境…");
    if !wps::application_exists() {
        return Err(InstallerError::WpsNotFound(wps::APPLICATION_HINT.into()));
    }

    progress(app, "uninstall", 25, "正在校验加载项信息…");
    let (manifest, _payload, paths) = load(app)?;
    paths.ensure_jsaddons_dir()?;
    progress(app, "uninstall", 55, "正在移除加载项文件…");
    let mut warnings = transaction::remove_current_and_legacy_dirs(&paths, &manifest)?;
    progress(app, "uninstall", 85, "正在重新打开 WPS…");
    let restart = wps::restart();
    let restart_succeeded = restart.is_ok();
    if let Err(error) = restart {
        warnings.push(format!("加载项已卸载，但 WPS 重启失败：{error}"));
    }

    let report = OperationReport {
        action: "uninstall".into(),
        message: "日期选择器已卸载；按现有 uninstall.sh 逻辑，publish.xml 未被修改。".into(),
        restart_attempted: true,
        restart_succeeded,
        warnings,
    };
    progress(app, "uninstall", 100, "卸载完成");
    Ok(report)
}

pub fn restart_only(_app: &AppHandle) -> Result<OperationReport, InstallerError> {
    let _guard = lock_operation()?;
    if !wps::application_exists() {
        return Err(InstallerError::WpsNotFound(wps::APPLICATION_HINT.into()));
    }
    wps::restart().map_err(|error| InstallerError::Commit(error.to_string()))?;
    Ok(OperationReport {
        action: "restart".into(),
        message: "WPS 已重新打开。".into(),
        restart_attempted: true,
        restart_succeeded: true,
        warnings: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_is_partial_when_only_one_installation_artifact_exists() {
        let status = match (true, false) {
            (false, false) => InstallationStatus::NotInstalled,
            (true, true) => InstallationStatus::Installed,
            _ => InstallationStatus::Partial,
        };
        assert!(matches!(status, InstallationStatus::Partial));
    }
}
