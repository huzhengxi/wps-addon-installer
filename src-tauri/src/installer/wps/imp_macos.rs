use std::{path::Path, process::Command, thread, time::Duration};

use super::Version;

pub const MINIMUM_SUPPORTED_VERSION: &str = "12.1.26055";
pub const APPLICATION_HINT: &str = "/Applications/wpsoffice.app";

const APPLICATION_PATH: &str = "/Applications/wpsoffice.app";
const INFO_PLIST_PATH: &str = "/Applications/wpsoffice.app/Contents/Info.plist";

pub fn application_exists() -> bool {
    Path::new(APPLICATION_PATH).is_dir()
}

pub fn version() -> Result<String, String> {
    let output = Command::new("plutil")
        .args([
            "-extract",
            "CFBundleShortVersionString",
            "raw",
            "-o",
            "-",
            INFO_PLIST_PATH,
        ])
        .output()
        .map_err(|error| format!("无法读取 WPS 的 Info.plist：{error}"))?;
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(if error.is_empty() {
            "Info.plist 中缺少 CFBundleShortVersionString。".into()
        } else {
            error
        });
    }

    let version = String::from_utf8(output.stdout)
        .map_err(|_| "WPS 版本号不是有效 UTF-8。".to_owned())?
        .trim()
        .to_owned();
    Version::parse(&version)?;
    Ok(version)
}

pub fn version_is_supported(version: &str) -> Result<bool, String> {
    Ok(Version::parse(version)? >= Version::parse(MINIMUM_SUPPORTED_VERSION)?)
}

pub fn is_running() -> bool {
    Command::new("pgrep")
        .args(["-f", "wpsoffice"])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub fn restart() -> Result<(), std::io::Error> {
    let stop_status = Command::new("pkill").args(["-f", "wpsoffice"]).status()?;
    if !stop_status.success() && stop_status.code() != Some(1) {
        return Err(std::io::Error::other("无法结束正在运行的 WPS 进程。"));
    }
    thread::sleep(Duration::from_secs(2));
    let launch_status = Command::new("open")
        .args(["-a", APPLICATION_PATH])
        .status()?;
    if !launch_status.success() {
        return Err(std::io::Error::other("无法重新打开 WPS。"));
    }
    Ok(())
}
