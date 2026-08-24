import "./styles.css";
import {
  type EnvironmentReport,
  type InstallationStatus,
  installAddon,
  inspectEnvironment,
  uninstallAddon
} from "./api";

const installButton = document.querySelector<HTMLButtonElement>("#install-button")!;
const uninstallButton = document.querySelector<HTMLButtonElement>("#uninstall-button")!;
const copyButton = document.querySelector<HTMLButtonElement>("#copy-diagnostics")!;
const title = document.querySelector<HTMLElement>("#status-title")!;
const badge = document.querySelector<HTMLElement>("#status-badge")!;
const details = document.querySelector<HTMLElement>("#environment-details")!;
const message = document.querySelector<HTMLElement>("#operation-message")!;

let latestReport: EnvironmentReport | undefined;

const labels: Record<InstallationStatus, string> = {
  not_installed: "尚未安装",
  installed: "已安装",
  partial: "需要修复",
  payload_invalid: "安装包异常",
  unsupported: "环境不支持"
};

function setBusy(busy: boolean, text?: string) {
  installButton.disabled = busy;
  uninstallButton.disabled = busy;
  copyButton.disabled = busy;
  if (text) message.textContent = text;
}

function setReport(report: EnvironmentReport) {
  latestReport = report;
  title.textContent = labels[report.installStatus];
  badge.textContent = labels[report.installStatus];
  badge.className = `badge ${report.installStatus}`;
  details.replaceChildren(
    ...[
      ["内置版本", report.addonVersion],
      ["WPS", report.wpsInstalled ? (report.wpsRunning ? "已安装，正在运行" : "已安装") : "未找到 /Applications/wpsoffice.app"],
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
  return typeof error === "string" ? error : "操作失败，请复制诊断信息后检查日志。";
}

async function run(action: "install" | "uninstall") {
  const prompt = action === "install"
    ? "安装或修复会关闭并重新打开 WPS。请先保存所有 WPS 文档，是否继续？"
    : "卸载会关闭并重新打开 WPS。请先保存所有 WPS 文档，是否继续？";
  if (!window.confirm(prompt)) return;

  setBusy(true, action === "install" ? "正在安装：校验载荷…" : "正在卸载加载项…");
  try {
    const result = action === "install" ? await installAddon() : await uninstallAddon();
    message.textContent = result.warnings.length
      ? `${result.message} ${result.warnings.join("；")}`
      : result.message;
    await refresh(false);
  } catch (error) {
    message.textContent = readableError(error);
  } finally {
    setBusy(false);
  }
}

installButton.addEventListener("click", () => void run("install"));
uninstallButton.addEventListener("click", () => void run("uninstall"));
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
