use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

use crate::model::{AppUpdateInfo, AppUpdateReport};

const CHECK_TIMEOUT: Duration = Duration::from_secs(30);
static UPDATE_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppUpdateProgress {
    downloaded: u64,
    total: Option<u64>,
    percent: Option<u8>,
    message: String,
}

fn updater(app: &AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    app.updater_builder()
        .timeout(CHECK_TIMEOUT)
        .build()
        .map_err(|error| format!("初始化应用更新器失败：{error}"))
}

fn progress(app: &AppHandle, downloaded: u64, total: Option<u64>, message: &str) {
    let percent = total
        .filter(|total| *total > 0)
        .map(|total| ((downloaded as f64 / total as f64) * 100.0).clamp(0.0, 100.0) as u8);
    let _ = app.emit(
        "app-update-progress",
        AppUpdateProgress {
            downloaded,
            total,
            percent,
            message: message.to_owned(),
        },
    );
}

pub async fn check(app: AppHandle) -> Result<AppUpdateReport, String> {
    let updater = updater(&app)?;
    let update = updater
        .check()
        .await
        .map_err(|error| format!("检查应用更新失败：{error}"))?;

    Ok(AppUpdateReport {
        current_version: app.package_info().version.to_string(),
        update: update.map(|update| AppUpdateInfo {
            version: update.version,
            notes: update.body,
            pub_date: update.date.map(|date| date.to_string()),
        }),
    })
}

pub async fn install_and_restart(app: AppHandle) -> Result<bool, String> {
    if UPDATE_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("应用更新正在进行中，请稍候。".into());
    }

    let result = install_inner(app.clone()).await;
    UPDATE_IN_PROGRESS.store(false, Ordering::SeqCst);
    result
}

async fn install_inner(app: AppHandle) -> Result<bool, String> {
    let updater = updater(&app)?;
    let Some(update) = updater
        .check()
        .await
        .map_err(|error| format!("检查应用更新失败：{error}"))?
    else {
        return Ok(false);
    };
    let update_version = update.version.clone();

    progress(&app, 0, None, &format!("正在下载 {}…", update.version));
    let mut downloaded = 0u64;
    let progress_app = app.clone();
    let bytes = update
        .download(
            move |chunk_len, content_len| {
                downloaded = downloaded.saturating_add(chunk_len as u64);
                progress(
                    &progress_app,
                    downloaded,
                    content_len,
                    &format!("正在下载 {update_version}…"),
                );
            },
            || {},
        )
        .await
        .map_err(|error| format!("下载或校验应用更新失败：{error}"))?;

    progress(&app, downloaded, Some(downloaded), "正在安装应用更新…");
    update
        .install(bytes)
        .map_err(|error| format!("安装应用更新失败：{error}"))?;

    #[cfg(not(target_os = "windows"))]
    {
        progress(
            &app,
            downloaded,
            Some(downloaded),
            "更新完成，正在重启应用…",
        );
        std::thread::sleep(Duration::from_millis(100));
        app.restart();
    }

    #[cfg(target_os = "windows")]
    {
        // The NSIS updater launches the installer and exits the current process.
        Ok(true)
    }
}
