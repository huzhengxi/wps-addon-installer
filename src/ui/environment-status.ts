import type { EnvironmentReport, InstallationStatus } from "../api";

export interface EnvironmentStatusView {
  setReport(report: EnvironmentReport): void;
  setError(error: string): void;
}

const labels: Record<InstallationStatus, string> = {
  not_installed: "尚未安装",
  installed: "已安装",
  partial: "需要修复",
  payload_invalid: "安装包异常",
  unsupported: "环境不支持"
};

export function createEnvironmentStatusView(options: {
  title: HTMLElement;
  badge: HTMLElement;
  description: HTMLElement;
  details: HTMLElement;
  isWindows: boolean;
}): EnvironmentStatusView {
  const { title, badge, description, details, isWindows } = options;
  const wpsNotFoundLabel = isWindows
    ? "未找到 WPS Office（需已安装并可从注册表或本地目录识别）"
    : "未找到 /Applications/wpsoffice.app";

  function renderDetails(report: EnvironmentReport) {
    const minimumVersion = `>= ${report.wpsMinimumVersion || "未知"}`;
    const entries = [
      ["内置版本", report.addonVersion],
      ["WPS", report.wpsInstalled ? (report.wpsRunning ? "已安装，正在运行" : "已安装") : wpsNotFoundLabel],
      ["WPS 版本", report.wpsVersion ?? "无法读取"],
      ["版本要求", report.wpsVersionSupported ? `${minimumVersion}（通过）` : `${minimumVersion}（不通过）`],
      ["运行架构", report.architecture],
      ["载荷校验", report.payloadValid ? "通过" : "失败"]
    ];

    details.replaceChildren(
      ...entries.map(([key, value]) => {
        const fragment = document.createDocumentFragment();
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = key;
        dd.textContent = value;
        fragment.append(dt, dd);
        return fragment;
      })
    );
  }

  return {
    setReport(report) {
      title.textContent = labels[report.installStatus];
      badge.textContent = labels[report.installStatus];
      badge.className = `badge ${report.installStatus}`;
      description.textContent = report.message;
      renderDetails(report);
    },
    setError(error) {
      title.textContent = "无法检查环境";
      badge.textContent = "错误";
      badge.className = "badge payload_invalid";
      description.textContent = error;
      details.replaceChildren();
    }
  };
}
