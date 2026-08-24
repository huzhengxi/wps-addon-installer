use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Deserialize;
use sha2::{Digest, Sha256};
use tauri::{path::BaseDirectory, AppHandle, Manager};

use super::InstallerError;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddonManifest {
    pub schema_version: u32,
    pub name: String,
    pub display_name: String,
    pub addon_type: String,
    pub version: String,
    pub archive: String,
    pub archive_root: String,
    pub archive_size: u64,
    pub archive_sha256: String,
    pub publish_artifact: String,
    pub publish_artifact_sha256: String,
    pub legacy_directory_names: Vec<String>,
    pub wps: WpsManifest,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WpsManifest {
    pub bundle_id: String,
    pub application_path: String,
    pub js_addons_relative_to_home: String,
}

#[derive(Debug, Clone)]
pub struct PayloadPaths {
    pub manifest: PathBuf,
    pub archive: PathBuf,
    pub publish_artifact: PathBuf,
}

impl PayloadPaths {
    pub fn from_app(app: &AppHandle) -> Result<Self, InstallerError> {
        let resolve = |relative: &str| {
            app.path()
                .resolve(relative, BaseDirectory::Resource)
                .map_err(|error| InstallerError::PayloadInvalid(error.to_string()))
        };
        Ok(Self {
            manifest: resolve("addon/addon-manifest.json")?,
            archive: resolve("addon/wps-addon-build/date-picker.7z")?,
            publish_artifact: resolve("addon/wps-addon-publish/publish.html")?,
        })
    }

    pub fn read_manifest(&self) -> Result<AddonManifest, InstallerError> {
        let content = fs::read_to_string(&self.manifest).map_err(|error| {
            InstallerError::PayloadInvalid(format!("无法读取资源清单：{error}"))
        })?;
        serde_json::from_str(&content).map_err(|error| {
            InstallerError::PayloadInvalid(format!("资源清单不是有效 JSON：{error}"))
        })
    }

    pub fn validate(&self, manifest: &AddonManifest) -> Result<(), InstallerError> {
        validate_file(
            &self.archive,
            manifest.archive_size,
            &manifest.archive_sha256,
            "date-picker.7z",
        )?;
        let publish_size = fs::metadata(&self.publish_artifact)
            .map_err(|error| InstallerError::PayloadInvalid(format!("缺少 publish.html：{error}")))?
            .len();
        validate_file(
            &self.publish_artifact,
            publish_size,
            &manifest.publish_artifact_sha256,
            "publish.html",
        )?;
        Ok(())
    }
}

impl AddonManifest {
    pub fn validate(&self) -> Result<(), InstallerError> {
        if self.schema_version != 1 {
            return Err(InstallerError::PayloadInvalid(
                "不支持的资源清单版本。".into(),
            ));
        }
        validate_token(&self.name, "加载项名称")?;
        validate_token(&self.version, "加载项版本")?;
        validate_token(&self.archive_root, "压缩包根目录")?;
        if self.archive_root != format!("{}_{}", self.name, self.version) {
            return Err(InstallerError::PayloadInvalid(
                "压缩包根目录与名称或版本不一致。".into(),
            ));
        }
        if self.addon_type != "et" || self.display_name.trim().is_empty() {
            return Err(InstallerError::PayloadInvalid(
                "加载项类型或显示名称无效。".into(),
            ));
        }
        if self.archive != "wps-addon-build/date-picker.7z"
            || self.publish_artifact != "wps-addon-publish/publish.html"
        {
            return Err(InstallerError::PayloadInvalid(
                "资源路径不符合第一版固定载荷约定。".into(),
            ));
        }
        if self.wps.bundle_id != "com.kingsoft.wpsoffice.mac"
            || self.wps.application_path != "/Applications/wpsoffice.app"
            || self.wps.js_addons_relative_to_home.contains("..")
        {
            return Err(InstallerError::PayloadInvalid("WPS 路径配置无效。".into()));
        }
        for name in &self.legacy_directory_names {
            validate_token(name, "兼容目录")?;
        }
        Ok(())
    }
}

pub fn validate_token(value: &str, label: &str) -> Result<(), InstallerError> {
    if value.is_empty()
        || value == "."
        || value == ".."
        || value.contains('/')
        || value.contains('\\')
        || !value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
    {
        return Err(InstallerError::PayloadInvalid(format!(
            "{label} 含有不安全字符。"
        )));
    }
    Ok(())
}

fn validate_file(
    path: &Path,
    expected_size: u64,
    expected_hash: &str,
    label: &str,
) -> Result<(), InstallerError> {
    let metadata = fs::metadata(path)
        .map_err(|error| InstallerError::PayloadInvalid(format!("缺少 {label}：{error}")))?;
    if !metadata.is_file() || metadata.len() != expected_size {
        return Err(InstallerError::PayloadInvalid(format!(
            "{label} 大小校验失败。"
        )));
    }
    let bytes = fs::read(path)
        .map_err(|error| InstallerError::PayloadInvalid(format!("无法读取 {label}：{error}")))?;
    let actual = hex::encode(Sha256::digest(bytes));
    if actual != expected_hash {
        return Err(InstallerError::PayloadInvalid(format!(
            "{label} SHA-256 校验失败。"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_validation_rejects_paths() {
        for input in ["", ".", "..", "a/b", "a\\b", "a b"] {
            assert!(
                validate_token(input, "test").is_err(),
                "{input} should fail"
            );
        }
        assert!(validate_token("date-picker_1.0.1", "test").is_ok());
    }
}
