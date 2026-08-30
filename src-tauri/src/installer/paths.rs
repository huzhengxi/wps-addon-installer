use std::{
    env, fs,
    path::{Path, PathBuf},
};

use super::{
    manifest::{validate_relative_path, validate_token, AddonManifest},
    InstallerError,
};
use crate::model::CatalogAddon;

#[derive(Debug, Clone)]
pub struct InstallPaths {
    pub jsaddons_dir: PathBuf,
    pub target_dir: PathBuf,
    pub publish_xml: PathBuf,
}

impl InstallPaths {
    pub fn from_manifest(manifest: &AddonManifest) -> Result<Self, InstallerError> {
        let home = home_dir()?;
        let jsaddons_relative = js_addons_relative_to_home(manifest, &home)?;
        let jsaddons_dir = safe_descendant(&home, jsaddons_relative)?;
        let target_dir = safe_child(&jsaddons_dir, &manifest.archive_root)?;
        let publish_xml = safe_child(&jsaddons_dir, "publish.xml")?;
        Ok(Self {
            jsaddons_dir,
            target_dir,
            publish_xml,
        })
    }

    pub fn from_catalog_addon(addon: &CatalogAddon) -> Result<Self, InstallerError> {
        Self::from_installation(&addon.id, &addon.version)
    }

    pub fn from_installation(id: &str, version: &str) -> Result<Self, InstallerError> {
        validate_token(id, "插件 ID")?;
        validate_token(version, "插件版本")?;
        let home = home_dir()?;
        #[cfg(target_os = "windows")]
        let relative = "AppData/Roaming/kingsoft/wps/jsaddons";
        #[cfg(target_os = "macos")]
        let relative = macos_jsaddons_relative_to_home(&home);
        let jsaddons_dir = safe_descendant(&home, relative)?;
        let archive_root = format!("{id}_{version}");
        Ok(Self {
            target_dir: safe_child(&jsaddons_dir, &archive_root)?,
            publish_xml: safe_child(&jsaddons_dir, "publish.xml")?,
            jsaddons_dir,
        })
    }

    pub fn ensure_jsaddons_dir(&self) -> Result<(), InstallerError> {
        fs::create_dir_all(&self.jsaddons_dir)?;
        let metadata = fs::symlink_metadata(&self.jsaddons_dir)?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(InstallerError::UnsafePath(
                "jsaddons 目录不能是符号链接且必须为目录。".into(),
            ));
        }
        Ok(())
    }

    pub fn checked_child(&self, name: &str) -> Result<PathBuf, InstallerError> {
        let parent = fs::canonicalize(&self.jsaddons_dir)?;
        safe_child(&parent, name)
    }
}

/// 解析当前用户主目录：Unix 使用 `$HOME`，Windows 使用 `%USERPROFILE%`。
fn home_dir() -> Result<PathBuf, InstallerError> {
    #[cfg(target_os = "windows")]
    let variable = "USERPROFILE";
    #[cfg(not(target_os = "windows"))]
    let variable = "HOME";
    env::var_os(variable)
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .ok_or_else(|| InstallerError::UnsafePath("无法取得当前用户主目录。".into()))
}

/// 按目标平台选择清单中的 jsaddons 相对路径。
fn js_addons_relative_to_home<'a>(manifest: &'a AddonManifest, home: &Path) -> Result<&'a str, InstallerError> {
    #[cfg(target_os = "windows")]
    {
        manifest
            .wps
            .windows
            .as_ref()
            .map(|windows| windows.js_addons_relative_to_home.as_str())
            .ok_or_else(|| {
                InstallerError::PayloadInvalid("资源清单缺少 Windows 加载项目录配置。".into())
            })
    }
    #[cfg(target_os = "macos")]
    {
        let _ = manifest;
        Ok(macos_jsaddons_relative_to_home(home))
    }
}

#[cfg(target_os = "macos")]
const SANDBOXED_JSADDONS_RELATIVE: &str =
    "Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons";
#[cfg(target_os = "macos")]
const LEGACY_JSADDONS_RELATIVE: &str = "Library/Application Support/Kingsoft/WPS Office/jsaddons";

/// Current macOS WPS releases are sandboxed and store JS add-ons inside their
/// container. Older releases used a shared Application Support directory, so
/// retain it as a fallback for compatibility.
#[cfg(target_os = "macos")]
fn macos_jsaddons_relative_to_home(home: &Path) -> &'static str {
    let sandboxed_wps_data = home.join("Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps");
    if sandboxed_wps_data.is_dir() {
        SANDBOXED_JSADDONS_RELATIVE
    } else {
        LEGACY_JSADDONS_RELATIVE
    }
}

/// 逐段拼接并校验相对路径，任意一段越界即拒绝。
pub fn safe_descendant(parent: &Path, relative: &str) -> Result<PathBuf, InstallerError> {
    validate_relative_path(relative)?;
    let mut current = parent.to_path_buf();
    for segment in relative.split('/') {
        current = safe_child(&current, segment)?;
    }
    Ok(current)
}

pub fn safe_child(parent: &Path, name: &str) -> Result<PathBuf, InstallerError> {
    validate_token(name, "目录名")?;
    let child = parent.join(name);
    if child.parent() != Some(parent) {
        return Err(InstallerError::UnsafePath(
            "目标路径越出 jsaddons 目录。".into(),
        ));
    }
    Ok(child)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_child_does_not_allow_parent_escape() {
        let root = Path::new("/tmp/jsaddons");
        assert_eq!(
            safe_child(root, "date-picker_1.0.1").unwrap(),
            root.join("date-picker_1.0.1")
        );
        assert!(safe_child(root, "../other").is_err());
    }

    #[test]
    fn safe_descendant_joins_valid_relative_paths() {
        let root = Path::new("/home/u");
        assert_eq!(
            safe_descendant(root, "AppData/Roaming/kingsoft/wps/jsaddons").unwrap(),
            root.join("AppData/Roaming/kingsoft/wps/jsaddons")
        );
        assert!(safe_descendant(root, "../escape").is_err());
        assert!(safe_descendant(root, "a//b").is_err());
        assert!(safe_descendant(root, "a/b/c").is_ok());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_prefers_the_existing_sandboxed_wps_data_directory() {
        let temporary = tempfile::tempdir().unwrap();
        assert_eq!(
            macos_jsaddons_relative_to_home(temporary.path()),
            LEGACY_JSADDONS_RELATIVE
        );
        std::fs::create_dir_all(
            temporary
                .path()
                .join("Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps"),
        )
        .unwrap();
        assert_eq!(
            macos_jsaddons_relative_to_home(temporary.path()),
            SANDBOXED_JSADDONS_RELATIVE
        );
    }
}
