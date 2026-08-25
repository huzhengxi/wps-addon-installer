use std::{path::Path, process::Command, thread, time::Duration};

const APPLICATION_PATH: &str = "/Applications/wpsoffice.app";
const INFO_PLIST_PATH: &str = "/Applications/wpsoffice.app/Contents/Info.plist";
pub const MINIMUM_SUPPORTED_VERSION: &str = "12.1.26055";

#[derive(Debug, Clone, Eq, Ord, PartialEq, PartialOrd)]
struct Version(Vec<u32>);

impl Version {
    fn parse(value: &str) -> Result<Self, String> {
        let mut components = value
            .trim()
            .split('.')
            .map(|component| {
                if component.is_empty() || !component.bytes().all(|byte| byte.is_ascii_digit()) {
                    return Err(format!("版本号格式无效：{value}"));
                }
                component
                    .parse::<u32>()
                    .map_err(|_| format!("版本号数字超出范围：{value}"))
            })
            .collect::<Result<Vec<_>, _>>()?;

        if components.is_empty() {
            return Err("版本号为空。".into());
        }
        while components.len() > 1 && components.last() == Some(&0) {
            components.pop();
        }
        Ok(Self(components))
    }
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_must_be_strictly_greater_than_the_minimum() {
        assert!(!version_is_supported("12.1.26055").unwrap());
        assert!(version_is_supported("12.1.26056").unwrap());
        assert!(version_is_supported("12.2.0").unwrap());
    }

    #[test]
    fn version_comparison_ignores_trailing_zero_components() {
        assert!(!version_is_supported("12.1.26055.0").unwrap());
        assert!(version_is_supported("12.1.26055.1").unwrap());
    }

    #[test]
    fn version_rejects_non_numeric_components() {
        assert!(version_is_supported("12.1.beta").is_err());
    }
}
