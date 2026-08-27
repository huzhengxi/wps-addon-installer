use std::{
    env,
    io::ErrorKind,
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::Duration,
};

use super::{parsing, Version};

/// WPS 官方宣布自 12.1.0.16910 起限制 oem.ini 方式加载；
/// publish.xml 发布流在企业版 11.8.2.8808、个人版 11.1.0.9566 开始支持。
pub const MINIMUM_SUPPORTED_VERSION: &str = "11.8.2.8808";
pub const APPLICATION_HINT: &str =
    "注册表 InstallRoot（Software\\Kingsoft\\Office\\6.0\\Common）或 %LOCALAPPDATA%\\Kingsoft\\WPS Office";

const REGISTRY_HIVES: &[&str] = &["HKCU", "HKLM"];
const REGISTRY_SUBKEY: &str = r"Software\Kingsoft\Office\6.0\Common";
const INSTALL_ROOT_VALUE: &str = "InstallRoot";
const OFFICE6_DIR: &str = "office6";
const PROCESS_NAMES: &[&str] = &["wpsoffice.exe", "wps.exe", "et.exe", "wpp.exe"];
const LAUNCHER_CANDIDATES: &[&str] = &["wpsoffice.exe", "wps.exe"];
const TASKKILL_EXIT_CODE_NOT_FOUND: i32 = 128;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone)]
struct OfficeLocation {
    exe: PathBuf,
    directory: PathBuf,
}

/// 创建不弹出控制台窗口的辅助命令。
fn quiet(program: &str) -> Command {
    let mut command = Command::new(program);
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

fn registry_install_root(hive: &str) -> Option<PathBuf> {
    let output = quiet("reg")
        .args([
            "query",
            &format!("{hive}\\{REGISTRY_SUBKEY}"),
            "/v",
            INSTALL_ROOT_VALUE,
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    parsing::reg_query_value(&String::from_utf8_lossy(&output.stdout), INSTALL_ROOT_VALUE)
        .filter(|value| Path::new(value).is_absolute())
        .map(PathBuf::from)
}

fn office_from_root(root: &Path) -> Option<OfficeLocation> {
    // 注册表值可能直接指向 office6 目录本身，也可能指向其上级版本目录。
    let directory = match root.file_name() {
        Some(name) if name == OFFICE6_DIR => root.to_path_buf(),
        _ => root.join(OFFICE6_DIR),
    };
    LAUNCHER_CANDIDATES.iter().find_map(|name| {
        let exe = directory.join(name);
        exe.is_file().then(|| OfficeLocation {
            exe,
            directory: directory.clone(),
        })
    })
}

fn scanned_roots() -> Vec<PathBuf> {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .map(|path| path.join("Kingsoft").join("WPS Office"));
    let Some(base) = base else {
        return Vec::new();
    };
    let Ok(entries) = std::fs::read_dir(&base) else {
        return Vec::new();
    };
    let mut roots: Vec<(Version, PathBuf)> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter_map(|path| {
            let name = path.file_name()?.to_string_lossy().trim().to_owned();
            if !looks_like_version(&name) {
                return None;
            }
            Version::parse(&name).ok().map(|version| (version, path))
        })
        .collect();
    roots.sort_by(|left, right| right.0.cmp(&left.0));
    roots.into_iter().map(|(_, path)| path).collect()
}

fn looks_like_version(name: &str) -> bool {
    let segments: Vec<&str> = name.trim().split('.').collect();
    segments.len() >= 3
        && segments
            .iter()
            .all(|segment| !segment.is_empty() && segment.bytes().all(|byte| byte.is_ascii_digit()))
}

fn resolve_office_location() -> Option<OfficeLocation> {
    for hive in REGISTRY_HIVES {
        if let Some(root) = registry_install_root(hive) {
            if let Some(location) = office_from_root(&root) {
                return Some(location);
            }
        }
    }
    scanned_roots()
        .into_iter()
        .find_map(|root| office_from_root(&root))
}

pub fn application_exists() -> bool {
    resolve_office_location().is_some()
}

pub fn version() -> Result<String, String> {
    let location = resolve_office_location()
        .ok_or_else(|| format!("未找到 WPS 安装目录（{APPLICATION_HINT}）。"))?;
    let directory_name = location
        .directory
        .parent()
        .and_then(|parent| parent.file_name())
        .map(|name| name.to_string_lossy().trim().to_owned())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| {
            format!(
                "无法从安装目录推断 WPS 版本：{}",
                location.directory.display()
            )
        })?;
    Version::parse(&directory_name)?;
    Ok(directory_name)
}

pub fn version_is_supported(version: &str) -> Result<bool, String> {
    Ok(Version::parse(version)? >= Version::parse(MINIMUM_SUPPORTED_VERSION)?)
}

fn image_running(image_name: &str) -> bool {
    quiet("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {image_name}"), "/NH"])
        .output()
        .map(|output| {
            parsing::tasklist_contains(&String::from_utf8_lossy(&output.stdout), image_name)
        })
        .unwrap_or(false)
}

pub fn is_running() -> bool {
    PROCESS_NAMES.iter().any(|name| image_running(name))
}

pub fn restart() -> Result<(), std::io::Error> {
    let mut failures = Vec::new();
    for name in PROCESS_NAMES {
        match quiet("taskkill").args(["/F", "/IM", name]).status() {
            Ok(status) if status.success() => {}
            // 没有该进程时 taskkill 返回 128，视为成功。
            Ok(status) if status.code() == Some(TASKKILL_EXIT_CODE_NOT_FOUND) => {}
            Ok(status) => failures.push(format!("{name}（退出码 {:?}）", status.code())),
            Err(error) => failures.push(format!("{name}（{error}）")),
        }
    }
    if failures.len() == PROCESS_NAMES.len() && !failures.is_empty() {
        return Err(std::io::Error::other(format!(
            "无法结束 WPS 进程：{}",
            failures.join("；")
        )));
    }

    thread::sleep(Duration::from_secs(2));
    if is_running() {
        return Err(std::io::Error::other(
            "WPS 进程无法被结束，请手动关闭后重试。",
        ));
    }

    let location = resolve_office_location()
        .ok_or_else(|| std::io::Error::new(ErrorKind::NotFound, "无法定位 WPS 启动程序。"))?;
    Command::new(&location.exe)
        .current_dir(&location.directory)
        .spawn()
        .map_err(|error| {
            std::io::Error::other(format!(
                "无法重新打开 WPS（{}）：{error}",
                location.exe.display()
            ))
        })?;
    Ok(())
}
