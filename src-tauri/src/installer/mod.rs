mod archive;
mod manifest;
mod paths;
mod publish_xml;
mod transaction;
mod wps;

use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Emitter};
use thiserror::Error;

use crate::model::{EnvironmentReport, InstallationStatus, OperationReport};
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

pub fn inspect(app: &AppHandle) -> Result<EnvironmentReport, InstallerError> {
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

    let (manifest, _payload, paths) = match load(app) {
        Ok(value) => value,
        Err(error) => {
            return Ok(EnvironmentReport {
                architecture,
                addon_version: "未知".into(),
                install_status: InstallationStatus::PayloadInvalid,
                wps_installed,
                wps_running,
                wps_version,
                wps_version_supported,
                wps_minimum_version: wps::MINIMUM_SUPPORTED_VERSION.into(),
                js_addons_path: "无法解析".into(),
                payload_valid: false,
                addon_directory_exists: false,
                publish_entry_matches: false,
                message: error.to_string(),
            });
        }
    };

    let addon_directory_exists = paths.target_dir.exists();
    let publish_entry_matches =
        publish_xml::matches(&paths.publish_xml, &manifest).unwrap_or(false);
    let install_status = match (addon_directory_exists, publish_entry_matches) {
        (false, false) => InstallationStatus::NotInstalled,
        (true, true) => InstallationStatus::Installed,
        _ => InstallationStatus::Partial,
    };
    let message = match install_status {
        InstallationStatus::NotInstalled => "尚未发现日期选择器加载项。".into(),
        InstallationStatus::Installed => "加载项目录和 publish.xml 配置均匹配。".into(),
        InstallationStatus::Partial => {
            "加载项目录与 publish.xml 配置不一致，可使用“安装 / 修复”。".into()
        }
        _ => unreachable!(),
    };

    Ok(EnvironmentReport {
        architecture,
        addon_version: manifest.version,
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
        .prefix("wps-addon-installer-")
        .tempdir()
        .map_err(InstallerError::Io)?;
    archive::extract_and_validate(&payload.archive, extraction.path(), &manifest)?;
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
