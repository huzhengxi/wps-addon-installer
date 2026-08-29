use std::{fs, path::Path};

use super::InstallerError;

pub fn extract_and_validate(
    archive: &Path,
    destination: &Path,
    archive_root: &str,
) -> Result<(), InstallerError> {
    sevenz_rust::decompress_file(archive, destination)
        .map_err(|error| InstallerError::Archive(error.to_string()))?;

    let entries = fs::read_dir(destination)?.collect::<Result<Vec<_>, _>>()?;
    if entries.len() != 1 {
        return Err(InstallerError::Archive(
            "压缩包必须只包含一个顶层目录。".into(),
        ));
    }
    let root = destination.join(archive_root);
    let metadata = fs::symlink_metadata(&root)
        .map_err(|_| InstallerError::Archive("压缩包根目录与资源清单不一致。".into()))?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(InstallerError::Archive("压缩包根目录无效。".into()));
    }
    validate_tree(&root)?;
    for required in ["manifest.xml", "index.html", "main.js"] {
        let path = root.join(required);
        if !path.is_file() {
            return Err(InstallerError::Archive(format!(
                "加载项缺少关键文件：{required}"
            )));
        }
    }
    Ok(())
}

fn validate_tree(path: &Path) -> Result<(), InstallerError> {
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let metadata = fs::symlink_metadata(entry.path())?;
        if metadata.file_type().is_symlink() {
            return Err(InstallerError::Archive("压缩包内不允许符号链接。".into()));
        }
        if metadata.is_dir() {
            validate_tree(&entry.path())?;
        } else if !metadata.is_file() {
            return Err(InstallerError::Archive(
                "压缩包内包含不支持的文件类型。".into(),
            ));
        }
    }
    Ok(())
}
