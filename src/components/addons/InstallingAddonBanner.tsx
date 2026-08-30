import type { Addon } from "../../types";
import { Spinner } from "../common/Spinner";

export function InstallingAddonBanner({ addon }: { addon: Addon }) {
  return <div role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:border-brand-600/30 dark:bg-brand-600/10 dark:text-brand-100">
    <Spinner size={19} />正在安装“{addon.name}”，正在下载、校验并部署插件，请稍候…
  </div>;
}
