import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { EnvironmentReport } from "../../api";

export function EnvironmentBanner({ environment, environmentError, onOpenPermissions }: { environment: EnvironmentReport | null; environmentError: string | null; onOpenPermissions: () => void }) {
  const environmentPassed = Boolean(environment?.wpsInstalled && environment.wpsVersionSupported);
  const environmentMessage = environmentError
    ? "环境检查失败。请前往“权限”页面，按提示授权后重新检测。"
    : environment
    ? environmentPassed
      ? `环境检查通过 · WPS ${environment.wpsVersion}`
      : environment.wpsInstalled
        ? `WPS ${environment.wpsVersion ?? "版本读取失败"} 不满足最低要求 ${environment.wpsMinimumVersion}`
        : "未检测到 WPS Office"
      : "正在检查 WPS 环境…";
  const environmentStyle = environmentError
    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
    : environmentPassed
      ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-600/30 dark:bg-brand-600/10 dark:text-brand-100"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
  return <div className={`mt-7 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${environmentStyle}`}>
    {environmentPassed ? <CheckCircleIcon size={19} weight="fill" /> : <WarningCircleIcon size={19} weight="fill" />}
    <span>{environmentMessage}</span>
    {environmentError && <button type="button" onClick={onOpenPermissions} className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40">前往权限</button>}
  </div>;
}
