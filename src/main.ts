import "./styles.css";
import {
  type EnvironmentReport,
  type InstallationStatus,
  type OperationProgress,
  type AppUpdateReport,
  type AppUpdateProgress,
  installAddon,
  checkAppUpdate,
  inspectEnvironment,
  installAppUpdateAndRestart,
  listenToAppUpdateProgress,
  listenToOperationProgress,
  uninstallAddon
} from "./api";
import { getVersion } from "@tauri-apps/api/app";

const installButton = document.querySelector<HTMLButtonElement>("#install-button")!;
const uninstallButton = document.querySelector<HTMLButtonElement>("#uninstall-button")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copy-diagnostics")!;
const title = document.querySelector<HTMLElement>("#status-title")!;
const badge = document.querySelector<HTMLElement>("#status-badge")!;
const details = document.querySelector<HTMLElement>("#environment-details")!;
const message = document.querySelector<HTMLElement>("#operation-message")!;
const progress = document.querySelector<HTMLElement>("#operation-progress")!;
const progressMessage = document.querySelector<HTMLElement>("#progress-message")!;
const progressPercent = document.querySelector<HTMLElement>("#progress-percent")!;
const progressTrack = document.querySelector<HTMLElement>("#progress-track")!;
const progressBar = document.querySelector<HTMLElement>("#progress-bar")!;
const confirmationDialog = document.querySelector<HTMLElement>("#confirmation-dialog")!;
const confirmationTitle = document.querySelector<HTMLElement>("#confirmation-title")!;
const confirmationMessage = document.querySelector<HTMLElement>("#confirmation-message")!;
const confirmationCancel = document.querySelector<HTMLButtonElement>("#confirmation-cancel")!;
const confirmationConfirm = document.querySelector<HTMLButtonElement>("#confirmation-confirm")!;
const appVersion = document.querySelector<HTMLElement>("#app-version")!;
const checkUpdateLink = document.querySelector<HTMLButtonElement>("#check-update-link")!;
const updateToast = document.querySelector<HTMLElement>("#update-toast")!;
const toastTitle = document.querySelector<HTMLElement>("#toast-title")!;
const toastNotes = document.querySelector<HTMLElement>("#toast-notes")!;
const toastProgress = document.querySelector<HTMLElement>("#toast-progress")!;
const toastProgressBar = document.querySelector<HTMLElement>("#toast-progress-bar")!;
const toastAction = document.querySelector<HTMLButtonElement>("#toast-action")!;
const toastDismiss = document.querySelector<HTMLButtonElement>("#toast-dismiss")!;

let latestReport: EnvironmentReport | undefined;
let confirmationResolver: ((confirmed: boolean) => void) | undefined;
let latestUpdate: AppUpdateReport | undefined;
let updateBusy = false;

const isWindows = navigator.userAgent.includes("Windows");
const wpsNotFoundLabel = isWindows
  ? "未找到 WPS Office（需已安装并可从注册表或本地目录识别）"
  : "未找到 /Applications/wpsoffice.app";

function minimumVersionLabel(report: EnvironmentReport) {
  return `>= ${report.wpsMinimumVersion || "未知"}`;
}

const labels: Record<InstallationStatus, string> = {
  not_installed: "尚未安装",
  installed: "已安装",
  partial: "需要修复",
  payload_invalid: "安装包异常",
  unsupported: "环境不支持"
};

type OperationAction = "install" | "uninstall";

function setBusy(busy: boolean, action?: OperationAction) {
  installButton.disabled = busy || !latestReport?.wpsVersionSupported;
  uninstallButton.disabled = busy;
  copyButton.disabled = busy;
  checkUpdateLink.disabled = busy || updateBusy;
  installButton.setAttribute("aria-busy", String(busy && action === "install"));
  uninstallButton.setAttribute("aria-busy", String(busy && action === "uninstall"));
  installButton.classList.toggle("is-loading", busy && action === "install");
  uninstallButton.classList.toggle("is-loading", busy && action === "uninstall");
  installButton.querySelector<HTMLElement>(".button-label")!.textContent =
    busy && action === "install" ? "正在安装…" : "安装 / 修复";
  uninstallButton.querySelector<HTMLElement>(".button-label")!.textContent =
    busy && action === "uninstall" ? "正在卸载…" : "卸载";
}

function setUpdateBusy(busy: boolean) {
  updateBusy = busy;
  checkUpdateLink.disabled = busy || installButton.disabled;
  toastAction.disabled = busy;
}

function updateProgress(update: OperationProgress) {
  const percent = Math.max(0, Math.min(100, update.percent));
  progress.hidden = false;
  progress.classList.remove("failed");
  progressMessage.textContent = update.message;
  progressPercent.textContent = `${percent}%`;
  progressTrack.setAttribute("aria-valuenow", String(percent));
  progressBar.style.width = `${percent}%`;
}

function failProgress(error: unknown) {
  progress.hidden = false;
  progress.classList.add("failed");
  progressMessage.textContent = readableError(error);
}

function resetProgress(action: "install" | "uninstall") {
  updateProgress({
    action,
    percent: 0,
    message: action === "install" ? "准备安装…" : "准备卸载…"
  });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function updateAppProgress(progress: AppUpdateProgress) {
  const percent = progress.percent ?? Math.max(0, Math.min(100, progress.downloaded));
  toastProgress.hidden = false;
  toastProgress.setAttribute("aria-valuenow", String(percent));
  toastProgressBar.style.width = `${percent}%`;
  toastTitle.textContent = progress.total
    ? `${progress.message} ${percent}%（${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}）`
    : `${progress.message} ${formatBytes(progress.downloaded)}`;
}

function showUpdateToast() {
  if (!latestUpdate?.update) return;
  toastTitle.textContent = `发现新版本 v${latestUpdate.update.version}`;
  toastNotes.textContent = latestUpdate.update.notes ?? "";
  toastNotes.hidden = !latestUpdate.update.notes;
  toastProgress.hidden = true;
  toastAction.hidden = false;
  toastAction.disabled = false;
  toastAction.textContent = "立即更新";
  toastDismiss.hidden = false;
  updateToast.hidden = false;
}

function hideUpdateToast() {
  updateToast.hidden = true;
  toastProgress.hidden = true;
}

function closeConfirmation(confirmed: boolean) {
  confirmationDialog.hidden = true;
  confirmationResolver?.(confirmed);
  confirmationResolver = undefined;
}

function confirmOperation(action: OperationAction | "app-update") {
  confirmationTitle.textContent =
    action === "install" ? "安装日期选择器？" : action === "uninstall" ? "卸载日期选择器？" : "更新安装器？";
  confirmationMessage.textContent =
    action === "install"
      ? "安装或修复会关闭并重新打开 WPS。请先保存所有正在编辑的 WPS 文档。"
      : action === "uninstall"
        ? "卸载会关闭并重新打开 WPS。请先保存所有正在编辑的 WPS 文档。"
        : "即将下载并安装新版安装器，安装完成后会重启本应用；已部署的 WPS 加载项不会被自动修改。";
  confirmationDialog.hidden = false;
  confirmationConfirm.textContent =
    action === "install" ? "开始安装" : action === "uninstall" ? "确认卸载" : "开始更新";
  confirmationConfirm.focus();
  return new Promise<boolean>((resolve) => {
    confirmationResolver = resolve;
  });
}

async function checkUpdates(silent: boolean): Promise<boolean> {
  if (updateBusy) return Boolean(latestUpdate?.update);
  if (!silent) {
    checkUpdateLink.textContent = "检查中…";
  }
  setUpdateBusy(true);
  try {
    latestUpdate = await checkAppUpdate();
    appVersion.textContent = `v${latestUpdate.currentVersion}`;
    setUpdateBusy(false);
    if (latestUpdate.update) {
      checkUpdateLink.textContent = "新版本可用";
      showUpdateToast();
    } else {
      checkUpdateLink.textContent = silent ? "检查更新" : "已是最新";
    }
    return Boolean(latestUpdate.update);
  } catch {
    setUpdateBusy(false);
    checkUpdateLink.textContent = silent ? "检查更新" : "检查失败，点击重试";
    return false;
  }
}

function setReport(report: EnvironmentReport) {
  latestReport = report;
  installButton.disabled = !report.wpsVersionSupported;
  title.textContent = labels[report.installStatus];
  badge.textContent = labels[report.installStatus];
  badge.className = `badge ${report.installStatus}`;
  details.replaceChildren(
    ...[
      ["内置版本", report.addonVersion],
      ["WPS", report.wpsInstalled ? (report.wpsRunning ? "已安装，正在运行" : "已安装") : wpsNotFoundLabel],
      ["WPS 版本", report.wpsVersion ?? "无法读取"],
      [
        "版本要求",
        report.wpsVersionSupported
          ? `${minimumVersionLabel(report)}（通过）`
          : `${minimumVersionLabel(report)}（不通过）`
      ],
      ["加载项状态", report.message],
      ["运行架构", report.architecture],
      ["载荷校验", report.payloadValid ? "通过" : "失败"]
    ].map(([key, value]) => {
      const fragment = document.createDocumentFragment();
      const dt = document.createElement("dt");
      dt.textContent = key;
      const dd = document.createElement("dd");
      dd.textContent = value;
      fragment.append(dt, dd);
      return fragment;
    })
  );
}

async function refresh(clearMessage = true) {
  try {
    setReport(await inspectEnvironment());
    if (clearMessage) message.textContent = "";
  } catch (error) {
    title.textContent = "无法检查环境";
    badge.textContent = "错误";
    badge.className = "badge payload_invalid";
    message.textContent = readableError(error);
  }
}

function readableError(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "操作失败，请复制诊断信息后检查日志。";
}

async function run(action: "install" | "uninstall") {
  if (!await confirmOperation(action)) return;

  message.textContent = "";
  resetProgress(action);
  setBusy(true, action);
  let unlisten: (() => void) | undefined;
  try {
    unlisten = await listenToOperationProgress((update) => {
      if (update.action === action) updateProgress(update);
    });
  } catch (error) {
    message.textContent = `无法显示实时阶段，操作将继续：${readableError(error)}`;
  }
  try {
    const result = action === "install" ? await installAddon() : await uninstallAddon();
    updateProgress({
      action,
      percent: 100,
      message: action === "install" ? "安装完成" : "卸载完成"
    });
    message.textContent = result.warnings.length
      ? `${result.message} ${result.warnings.join("；")}`
      : result.message;
    await refresh(false);
  } catch (error) {
    message.textContent = readableError(error);
    failProgress(error);
  } finally {
    unlisten?.();
    setBusy(false);
  }
}

async function runAppUpdate() {
  if (updateBusy) return;
  if (!latestUpdate?.update) {
    void checkUpdates(false);
    return;
  }
  if (!await confirmOperation("app-update")) return;

  setUpdateBusy(true);
  toastAction.textContent = "正在更新…";
  toastDismiss.hidden = true;
  toastProgress.hidden = false;
  toastProgressBar.style.width = "0%";
  let unlisten: (() => void) | undefined;
  try {
    unlisten = await listenToAppUpdateProgress(updateAppProgress);
    const installed = await installAppUpdateAndRestart();
    if (!installed) {
      toastTitle.textContent = "已是最新版本。";
      toastProgress.hidden = true;
    }
  } catch (error) {
    toastTitle.textContent = readableError(error);
    toastProgress.hidden = true;
  } finally {
    unlisten?.();
    setUpdateBusy(false);
    toastAction.textContent = "立即更新";
    toastAction.hidden = false;
    toastDismiss.hidden = false;
  }
}

confirmationCancel.addEventListener("click", () => closeConfirmation(false));
confirmationConfirm.addEventListener("click", () => closeConfirmation(true));
confirmationDialog.addEventListener("click", (event) => {
  if (event.target === confirmationDialog) closeConfirmation(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !confirmationDialog.hidden) closeConfirmation(false);
});
installButton.addEventListener("click", () => void run("install"));
uninstallButton.addEventListener("click", () => void run("uninstall"));
checkUpdateLink.addEventListener("click", () => {
  if (latestUpdate?.update) {
    showUpdateToast();
  } else {
    void checkUpdates(false);
  }
});
toastAction.addEventListener("click", () => void runAppUpdate());
toastDismiss.addEventListener("click", hideUpdateToast);
copyButton.addEventListener("click", async () => {
  const text = JSON.stringify(latestReport ?? { error: "尚未获取诊断信息" }, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    message.textContent = "诊断信息已复制。";
  } catch {
    message.textContent = "无法访问剪贴板，请在开发者工具中查看诊断信息。";
  }
});

void refresh();
void getVersion().then((version) => {
  appVersion.textContent = `v${version}`;
}).catch(() => {});
window.setTimeout(() => void checkUpdates(true), 1500);
