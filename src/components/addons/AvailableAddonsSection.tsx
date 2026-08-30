import type { Addon } from "../../types";
import { AvailableAddonRow } from "./AvailableAddonRow";

export function AvailableAddonsSection({ available, installed, query, isRefreshing, installingAddonId, install }: { available: Addon[]; installed: Addon[]; query: string; isRefreshing: boolean; installingAddonId: string | null; install: (id: string) => void }) {
  return <section className="mt-9">
    <h3 className="mb-3 text-lg font-bold">可安装与更新</h3>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {available.length ? available.map((addon) => <AvailableAddonRow
        key={addon.id}
        addon={addon}
        installedVersion={installed.find((item) => item.id === addon.id)?.version}
        isInstalling={installingAddonId === addon.id}
        disabled={isRefreshing || Boolean(installingAddonId)}
        onInstall={() => install(addon.id)}
      />) : <p className="p-8 text-center text-sm text-slate-500">{query.trim() ? "未找到匹配的插件。" : "暂无可安装或可更新的插件。"}</p>}
    </div>
  </section>;
}
