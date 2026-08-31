import { DownloadSimpleIcon } from "@phosphor-icons/react";
import type { Addon } from "../../types";
import { AvailableAddonRow } from "./AvailableAddonRow";

export function AvailableAddonsSection({ available, installed, query, isRefreshing, installingAddonId, install }: { available: Addon[]; installed: Addon[]; query: string; isRefreshing: boolean; installingAddonId: string | null; install: (id: string) => void }) {
  return <section className="mt-7">
    <h3 className="mb-2.5 text-base font-semibold">可安装与更新</h3>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02] dark:border-slate-800 dark:bg-slate-900">
      {available.length ? available.map((addon) => <AvailableAddonRow
        key={addon.id}
        addon={addon}
        installedVersion={installed.find((item) => item.id === addon.id)?.version}
        isInstalling={installingAddonId === addon.id}
        disabled={isRefreshing || Boolean(installingAddonId)}
        onInstall={() => install(addon.id)}
      />) : <div className="grid place-items-center px-6 py-7 text-center"><span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><DownloadSimpleIcon size={20} /></span><p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">{query.trim() ? "未找到匹配的插件" : "暂无可安装或可更新的插件"}</p><p className="mt-1 text-xs text-slate-400">{query.trim() ? "试试其他关键词" : "刷新后会显示控件源中的最新版本"}</p></div>}
    </div>
  </section>;
}
