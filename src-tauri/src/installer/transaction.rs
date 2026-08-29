use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use super::{manifest::AddonManifest, paths::InstallPaths, publish_xml, InstallerError};
use crate::model::CatalogAddon;

fn nonce() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .to_string()
}

pub fn install(
    paths: &InstallPaths,
    extracted_root: PathBuf,
    manifest: &AddonManifest,
) -> Result<(), InstallerError> {
    let stage_name = format!(".{}.stage-{}", manifest.archive_root, nonce());
    let backup_name = format!(".{}.backup-{}", manifest.archive_root, nonce());
    let xml_temp_name = format!(".publish.xml.tmp-{}", nonce());
    let xml_backup_name = format!(".publish.xml.backup-{}", nonce());
    let stage = paths.checked_child(&stage_name)?;
    let backup = paths.checked_child(&backup_name)?;
    let xml_temp = paths.checked_child(&xml_temp_name)?;
    let xml_backup = paths.checked_child(&xml_backup_name)?;

    copy_dir(&extracted_root, &stage)?;
    validate_staged_addon(&stage)?;
    publish_xml::write_temp(&xml_temp, &publish_xml::render(manifest))?;

    let target_existed = checked_exists(&paths.target_dir)?;
    let xml_existed = checked_exists(&paths.publish_xml)?;
    let commit_result = (|| -> Result<(), InstallerError> {
        if target_existed {
            fs::rename(&paths.target_dir, &backup)?;
        }
        fs::rename(&stage, &paths.target_dir)?;
        if xml_existed {
            fs::rename(&paths.publish_xml, &xml_backup)?;
        }
        fs::rename(&xml_temp, &paths.publish_xml)?;
        Ok(())
    })();

    if let Err(error) = commit_result {
        let rollback = rollback(
            &paths.target_dir,
            &backup,
            target_existed,
            &paths.publish_xml,
            &xml_backup,
            xml_existed,
        );
        cleanup_path(&stage);
        cleanup_path(&xml_temp);
        return match rollback {
            Ok(()) => Err(InstallerError::Commit(error.to_string())),
            Err(rollback_error) => Err(InstallerError::Commit(format!(
                "{error}；回滚也失败：{rollback_error}"
            ))),
        };
    }

    cleanup_path(&backup);
    cleanup_path(&xml_backup);
    Ok(())
}

pub fn install_catalog(
    paths: &InstallPaths,
    extracted_root: PathBuf,
    addon: &CatalogAddon,
    archive_root: &str,
) -> Result<(), InstallerError> {
    let stage_name = format!(".{}.stage-{}", archive_root, nonce());
    let backup_name = format!(".{}.backup-{}", archive_root, nonce());
    let xml_temp_name = format!(".publish.xml.tmp-{}", nonce());
    let xml_backup_name = format!(".publish.xml.backup-{}", nonce());
    let stage = paths.checked_child(&stage_name)?;
    let backup = paths.checked_child(&backup_name)?;
    let xml_temp = paths.checked_child(&xml_temp_name)?;
    let xml_backup = paths.checked_child(&xml_backup_name)?;
    copy_dir(&extracted_root, &stage)?;
    validate_staged_addon(&stage)?;
    let existing_xml = fs::read_to_string(&paths.publish_xml).ok();
    publish_xml::write_temp(&xml_temp, &publish_xml::merge_catalog(existing_xml.as_deref(), addon, archive_root))?;
    let target_existed = checked_exists(&paths.target_dir)?;
    let xml_existed = checked_exists(&paths.publish_xml)?;
    let commit_result = (|| -> Result<(), InstallerError> {
        if target_existed { fs::rename(&paths.target_dir, &backup)?; }
        fs::rename(&stage, &paths.target_dir)?;
        if xml_existed { fs::rename(&paths.publish_xml, &xml_backup)?; }
        fs::rename(&xml_temp, &paths.publish_xml)?;
        Ok(())
    })();
    if let Err(error) = commit_result {
        let rollback = rollback(&paths.target_dir, &backup, target_existed, &paths.publish_xml, &xml_backup, xml_existed);
        cleanup_path(&stage);
        cleanup_path(&xml_temp);
        return match rollback {
            Ok(()) => Err(InstallerError::Commit(error.to_string())),
            Err(rollback_error) => Err(InstallerError::Commit(format!("{error}；回滚也失败：{rollback_error}"))),
        };
    }
    cleanup_path(&backup);
    cleanup_path(&xml_backup);
    Ok(())
}

pub fn remove_current_and_legacy_dirs(
    paths: &InstallPaths,
    manifest: &AddonManifest,
) -> Result<Vec<String>, InstallerError> {
    let mut warnings = Vec::new();
    remove_directory(&paths.target_dir, &mut warnings)?;
    for legacy in &manifest.legacy_directory_names {
        let path = paths.checked_child(legacy)?;
        remove_directory(&path, &mut warnings)?;
    }
    Ok(warnings)
}

pub fn remove_legacy_dirs(paths: &InstallPaths, manifest: &AddonManifest) -> Vec<String> {
    let mut warnings = Vec::new();
    for legacy in &manifest.legacy_directory_names {
        match paths
            .checked_child(legacy)
            .and_then(|path| remove_directory(&path, &mut warnings))
        {
            Ok(()) => {}
            Err(error) => warnings.push(format!("未能清理兼容目录 {legacy}：{error}")),
        }
    }
    warnings
}

fn remove_directory(path: &Path, warnings: &mut Vec<String>) -> Result<(), InstallerError> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(InstallerError::Io(error)),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(InstallerError::UnsafePath(format!(
            "拒绝删除非目录或符号链接：{}",
            path.display()
        )));
    }
    fs::remove_dir_all(path)?;
    warnings.push(format!(
        "已清理兼容目录：{}",
        path.file_name().unwrap_or_default().to_string_lossy()
    ));
    Ok(())
}

fn checked_exists(path: &Path) -> Result<bool, InstallerError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                Err(InstallerError::UnsafePath(format!(
                    "拒绝操作符号链接：{}",
                    path.display()
                )))
            } else {
                Ok(true)
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(InstallerError::Io(error)),
    }
}

fn rollback(
    target: &Path,
    backup: &Path,
    target_existed: bool,
    xml: &Path,
    xml_backup: &Path,
    xml_existed: bool,
) -> Result<(), std::io::Error> {
    cleanup_path(target);
    cleanup_path(xml);
    if target_existed && backup.exists() {
        fs::rename(backup, target)?;
    }
    if xml_existed && xml_backup.exists() {
        fs::rename(xml_backup, xml)?;
    }
    Ok(())
}

fn validate_staged_addon(path: &Path) -> Result<(), InstallerError> {
    for required in ["manifest.xml", "index.html", "main.js"] {
        if !path.join(required).is_file() {
            return Err(InstallerError::Commit(format!(
                "暂存加载项缺少关键文件：{required}"
            )));
        }
    }
    Ok(())
}

fn copy_dir(source: &Path, destination: &Path) -> Result<(), InstallerError> {
    let metadata = fs::symlink_metadata(source)?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(InstallerError::Archive(
            "加载项根目录必须是非链接目录。".into(),
        ));
    }
    fs::create_dir(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let metadata = fs::symlink_metadata(&source_path)?;
        if metadata.file_type().is_symlink() {
            return Err(InstallerError::Archive("加载项内不允许符号链接。".into()));
        }
        if metadata.is_dir() {
            copy_dir(&source_path, &destination_path)?;
        } else if metadata.is_file() {
            fs::copy(&source_path, &destination_path)?;
        } else {
            return Err(InstallerError::Archive(
                "加载项内包含不支持的文件类型。".into(),
            ));
        }
    }
    Ok(())
}

fn cleanup_path(path: &Path) {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {
            let _ = fs::remove_dir_all(path);
        }
        Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {
            let _ = fs::remove_file(path);
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_dir_rejects_a_symlink() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source");
        let destination = temp.path().join("destination");
        fs::create_dir(&source).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink("/tmp", source.join("link")).unwrap();
        #[cfg(unix)]
        assert!(copy_dir(&source, &destination).is_err());
    }
}
