use std::{path::Path, process::Command, thread, time::Duration};

const APPLICATION_PATH: &str = "/Applications/wpsoffice.app";

pub fn application_exists() -> bool {
    Path::new(APPLICATION_PATH).is_dir()
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
