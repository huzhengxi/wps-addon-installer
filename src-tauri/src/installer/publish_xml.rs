use std::{fs, io::Write, path::Path};

use super::{manifest::AddonManifest, InstallerError};
use crate::model::CatalogAddon;

pub fn render(manifest: &AddonManifest) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<jsplugins>\n  <jsplugin name=\"{}\" type=\"{}\" url=\"{}\" version=\"{}\" enable=\"enable_dev\" install=\"null\" customDomain=\"\"/>\n</jsplugins>\n",
        manifest.name, manifest.addon_type, manifest.archive_root, manifest.version
    )
}

pub fn merge_catalog(existing: Option<&str>, addon: &CatalogAddon, archive_root: &str) -> String {
    let entry = format!(
        "  <jsplugin name=\"{}\" type=\"{}\" url=\"{}\" version=\"{}\" enable=\"enable_dev\" install=\"null\" customDomain=\"\"/>\n",
        addon.id, addon.addon_type, archive_root, addon.version
    );
    let retained = existing
        .map(|content| remove_entry(content, &addon.id))
        .unwrap_or_else(|| "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<jsplugins>\n</jsplugins>\n".into());
    retained.replacen("</jsplugins>", &(entry + "</jsplugins>"), 1)
}

/// Removes just the self-closing WPS entry whose safe name exactly matches.
/// Other XML is kept byte-for-byte, so external plugins are not overwritten.
fn remove_entry(content: &str, name: &str) -> String {
    let needle = format!("<jsplugin name=\"{}\"", name);
    let mut remaining = content;
    let mut output = String::with_capacity(content.len());
    while let Some(start) = remaining.find(&needle) {
        output.push_str(&remaining[..start]);
        let after_start = &remaining[start..];
        let Some(end) = after_start.find("/>") else {
            output.push_str(after_start);
            return output;
        };
        remaining = &after_start[end + 2..];
    }
    output.push_str(remaining);
    output
}

pub fn remove_catalog_entry(existing: &str, name: &str) -> String {
    remove_entry(existing, name)
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
