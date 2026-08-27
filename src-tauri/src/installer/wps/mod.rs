#[cfg(not(any(target_os = "macos", target_os = "windows")))]
compile_error!("此安装器只支持 macOS 与 Windows 目标平台。");

#[cfg(target_os = "macos")]
mod imp_macos;
#[cfg(target_os = "macos")]
use imp_macos as imp;

#[cfg(target_os = "windows")]
mod imp_windows;
#[cfg(target_os = "windows")]
use imp_windows as imp;

/// 当前平台要求的最低 WPS 版本。
pub use imp::MINIMUM_SUPPORTED_VERSION;
pub use imp::{
    application_exists, is_running, restart, version, version_is_supported, APPLICATION_HINT,
};

#[derive(Debug, Clone, Eq, Ord, PartialEq, PartialOrd)]
pub(crate) struct Version(Vec<u32>);

impl Version {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
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

// 纯解析工具函数：仅 Windows 实现使用；在测试构建中也编译，便于跨平台验证。
#[cfg(any(target_os = "windows", test))]
pub(crate) mod parsing {
    /// 从 `reg query` 的标准输出中提取指定值的 REG_SZ 字符串。
    pub(crate) fn reg_query_value(output: &str, value_name: &str) -> Option<String> {
        for line in output.lines() {
            let Some(start) = line.find(value_name) else {
                continue;
            };
            let rest = &line[start + value_name.len()..];
            let Some(kind_index) = rest.find("REG_SZ") else {
                continue;
            };
            let value = rest[kind_index + "REG_SZ".len()..].trim();
            let value = value.trim_matches('"').trim();
            if !value.is_empty() {
                return Some(value.to_owned());
            }
        }
        None
    }

    /// 判断 `tasklist /NH` 输出中是否包含指定镜像名（大小写不敏感）。
    pub(crate) fn tasklist_contains(output: &str, image_name: &str) -> bool {
        output.to_lowercase().contains(&image_name.to_lowercase())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_comparison_is_numeric() {
        assert!(Version::parse("12.1.26055").unwrap() < Version::parse("12.1.26056").unwrap());
        assert!(Version::parse("11.8.2.8807").unwrap() < Version::parse("11.8.2.8808").unwrap());
        assert!(Version::parse("12.2.0").unwrap() > Version::parse("12.1.9").unwrap());
    }

    #[test]
    fn version_comparison_ignores_trailing_zero_components() {
        assert_eq!(
            Version::parse("11.8.2.8808").unwrap(),
            Version::parse("11.8.2.8808.0").unwrap()
        );
        assert!(Version::parse("11.8.2.8808.1").unwrap() > Version::parse("11.8.2.8808").unwrap());
    }

    #[test]
    fn version_rejects_non_numeric_components() {
        assert!(Version::parse("12.1.beta").is_err());
        assert!(Version::parse("").is_err());
    }

    #[test]
    fn reg_query_value_parses_spaced_and_quoted_paths() {
        let output = "\r\nHKEY_CURRENT_USER\\Software\\Kingsoft\\Office\\6.0\\Common\r\n    \
                      InstallRoot    REG_SZ    C:\\Users\\Li Qi\\AppData\\Local\\Kingsoft\\WPS \
                      Office\\12.1.0.19382\\\r\n\r\n";
        assert_eq!(
            parsing::reg_query_value(output, "InstallRoot").as_deref(),
            Some("C:\\Users\\Li Qi\\AppData\\Local\\Kingsoft\\WPS Office\\12.1.0.19382\\")
        );
        assert_eq!(parsing::reg_query_value(output, "MissingValue"), None);
    }

    #[test]
    fn tasklist_output_detection_is_case_insensitive() {
        assert!(parsing::tasklist_contains(
            "wpsoffice.exe    1234 Console",
            "wpsoffice.exe"
        ));
        assert!(!parsing::tasklist_contains(
            "信息: 没有运行的任务匹配指定标准。",
            "et.exe"
        ));
    }
}
