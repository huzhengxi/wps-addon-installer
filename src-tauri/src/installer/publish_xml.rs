use std::{fs, io::Write, path::Path};

use super::{manifest::AddonManifest, InstallerError};

pub fn render(manifest: &AddonManifest) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<jsplugins>\n  <jsplugin name=\"{}\" type=\"{}\" url=\"{}\" version=\"{}\" enable=\"enable_dev\" install=\"null\" customDomain=\"\"/>\n</jsplugins>\n",
        manifest.name, manifest.addon_type, manifest.archive_root, manifest.version
    )
}

pub fn matches(path: &Path, manifest: &AddonManifest) -> Result<bool, InstallerError> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(InstallerError::Io(error)),
    };
    Ok(content.contains(&format!("name=\"{}\"", manifest.name))
        && content.contains(&format!("type=\"{}\"", manifest.addon_type))
        && content.contains(&format!("url=\"{}\"", manifest.archive_root))
        && content.contains(&format!("version=\"{}\"", manifest.version)))
}

pub fn write_temp(path: &Path, content: &str) -> Result<(), InstallerError> {
    let mut file = fs::File::create(path)?;
    file.write_all(content.as_bytes())?;
    file.sync_all()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::installer::manifest::{AddonManifest, WpsManifest};

    fn manifest() -> AddonManifest {
        AddonManifest {
            schema_version: 1,
            name: "date-picker".into(),
            display_name: "日期选择器".into(),
            addon_type: "et".into(),
            version: "1.0.1".into(),
            archive: "wps-addon-build/date-picker.7z".into(),
            archive_root: "date-picker_1.0.1".into(),
            archive_size: 0,
            archive_sha256: String::new(),
            publish_artifact: "wps-addon-publish/publish.html".into(),
            publish_artifact_sha256: String::new(),
            legacy_directory_names: vec![],
            wps: WpsManifest {
                bundle_id: "com.kingsoft.wpsoffice.mac".into(),
                application_path: "/Applications/wpsoffice.app".into(),
                js_addons_relative_to_home: "Library/test".into(),
                windows: None,
            },
        }
    }

    #[test]
    fn generated_xml_uses_manifest_version() {
        let text = render(&manifest());
        assert!(text.contains("url=\"date-picker_1.0.1\""));
        assert!(text.contains("version=\"1.0.1\""));
    }
}
