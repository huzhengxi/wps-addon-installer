use std::{
    env, fs,
    path::{Path, PathBuf},
};

use super::{
    manifest::{validate_token, AddonManifest},
    InstallerError,
};

#[derive(Debug, Clone)]
pub struct InstallPaths {
    pub jsaddons_dir: PathBuf,
    pub target_dir: PathBuf,
    pub publish_xml: PathBuf,
}

impl InstallPaths {
    pub fn from_manifest(manifest: &AddonManifest) -> Result<Self, InstallerError> {
        let home = env::var_os("HOME")
            .map(PathBuf::from)
            .filter(|path| path.is_absolute())
            .ok_or_else(|| InstallerError::UnsafePath("无法取得当前用户主目录。".into()))?;
        let jsaddons_dir = home.join(&manifest.wps.js_addons_relative_to_home);
        let target_dir = safe_child(&jsaddons_dir, &manifest.archive_root)?;
        let publish_xml = safe_child(&jsaddons_dir, "publish.xml")?;
        Ok(Self {
            jsaddons_dir,
            target_dir,
            publish_xml,
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
}
