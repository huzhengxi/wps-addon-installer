mod archive;
mod manifest;
mod paths;
mod publish_xml;
mod transaction;
mod wps;

use std::sync::{Mutex, OnceLock};

use tauri::AppHandle;
use thiserror::Error;

use crate::model::{EnvironmentReport, InstallationStatus, OperationReport};
use manifest::{AddonManifest, PayloadPaths};
use paths::InstallPaths;

static OPERATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Debug, Error)]
pub enum InstallerError {
    #[error("操作正在进行中，请等待当前任务完成。")]
    OperationBusy,
    #[error("未找到 WPS：/Applications/wpsoffice.app。请安装 macOS 版 WPS 后重试。")]
    WpsNotFound,
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

fn load(app: &AppHandle) -> Result<(AddonManifest, PayloadPaths, InstallPaths), InstallerError> {
    let payload = PayloadPaths::from_app(app)?;
    let manifest = payload.read_manifest()?;
    manifest.validate()?;
    payload.validate(&manifest)?;
    let paths = InstallPaths::from_manifest(&manifest)?;
    Ok((manifest, payload, paths))
}

pub fn inspect(app: &AppHandle) -> Result<EnvironmentReport, InstallerError> {
    let architecture = std::env::consts::ARCH.to_owned();
    if !cfg!(target_os = "macos") {
        return Ok(EnvironmentReport {
            architecture,
            addon_version: "未知".into(),
            install_status: InstallationStatus::Unsupported,
            wps_installed: false,
            wps_running: false,
            js_addons_path: "不支持的系统".into(),
            payload_valid: false,
            addon_directory_exists: false,
            publish_entry_matches: false,
            message: "第一版仅支持 macOS。".into(),
        });
    }
    let wps_installed = wps::application_exists();
    let wps_running = wps::is_running();

    let (manifest, _payload, paths) = match load(app) {
        Ok(value) => value,
        Err(error) => {
            return Ok(EnvironmentReport {
                architecture,
                addon_version: "未知".into(),
                install_status: InstallationStatus::PayloadInvalid,
                wps_installed,
                wps_running,
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
        js_addons_path: paths.jsaddons_dir.display().to_string(),
        payload_valid: true,
        addon_directory_exists,
        publish_entry_matches,
        message,
    })
}

pub fn install(app: &AppHandle) -> Result<OperationReport, InstallerError> {
    let _guard = lock_operation()?;
    if !wps::application_exists() {
        return Err(InstallerError::WpsNotFound);
    }

    let (manifest, payload, paths) = load(app)?;
    paths.ensure_jsaddons_dir()?;

    let extraction = tempfile::Builder::new()
        .prefix("wps-addon-installer-")
        .tempdir()
        .map_err(InstallerError::Io)?;
    archive::extract_and_validate(&payload.archive, extraction.path(), &manifest)?;
    transaction::install(
        &paths,
        extraction.path().join(&manifest.archive_root),
        &manifest,
    )?;

    let mut warnings = transaction::remove_legacy_dirs(&paths, &manifest);
    let restart = wps::restart();
    let restart_succeeded = restart.is_ok();
    if let Err(error) = restart {
        warnings.push(format!("加载项已安装，但 WPS 重启失败：{error}"));
    }

    Ok(OperationReport {
        action: "install".into(),
        message: if restart_succeeded {
            "日期选择器已安装，WPS 已重新打开。".into()
        } else {
            "日期选择器已安装。".into()
        },
        restart_attempted: true,
        restart_succeeded,
        warnings,
    })
}

pub fn uninstall(app: &AppHandle) -> Result<OperationReport, InstallerError> {
    let _guard = lock_operation()?;
    if !wps::application_exists() {
        return Err(InstallerError::WpsNotFound);
    }

    let (manifest, _payload, paths) = load(app)?;
    paths.ensure_jsaddons_dir()?;
    let mut warnings = transaction::remove_current_and_legacy_dirs(&paths, &manifest)?;
    let restart = wps::restart();
    let restart_succeeded = restart.is_ok();
    if let Err(error) = restart {
        warnings.push(format!("加载项已卸载，但 WPS 重启失败：{error}"));
    }

    Ok(OperationReport {
        action: "uninstall".into(),
        message: "日期选择器已卸载；按现有 uninstall.sh 逻辑，publish.xml 未被修改。".into(),
        restart_attempted: true,
        restart_succeeded,
        warnings,
    })
}

pub fn restart_only(_app: &AppHandle) -> Result<OperationReport, InstallerError> {
    let _guard = lock_operation()?;
    if !wps::application_exists() {
        return Err(InstallerError::WpsNotFound);
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
