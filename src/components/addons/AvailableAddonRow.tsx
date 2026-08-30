import { CalendarDotsIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import type { Addon } from "../../types";
import { Spinner } from "../common/Spinner";
import { StatusPill } from "../common/StatusPill";

export function AvailableAddonRow({ addon, installedVersion, isInstalling, disabled, onInstall }: { addon: Addon; installedVersion: string | undefined; isInstalling: boolean; disabled: boolean; onInstall: () => void }) {
  const isUpdate = installedVersion !== undefined;
  return <div className="flex items-center gap-4 px-5 py-5">
    <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15"><CalendarDotsIcon size={24} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2"><h4 className="font-bold">{addon.name}</h4><span className="text-xs text-slate-400">v{addon.version}</span>{isUpdate && <StatusPill tone="warning">可更新</StatusPill>}</div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{addon.description}</p>
      <p className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-300">{isUpdate ? `已安装 v${installedVersion} · ${addon.source}` : addon.source}</p>
    </div>
    <button type="button" disabled={disabled} onClick={onInstall} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70">
      {isInstalling ? <Spinner size={18} /> : <DownloadSimpleIcon size={18} />}{isInstalling ? (isUpdate ? "正在更新…" : "正在安装…") : (isUpdate ? "更新" : "安装")}
    </button>
  </div>;
}
