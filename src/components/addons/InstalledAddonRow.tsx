import { FileTextIcon } from "@phosphor-icons/react";
import type { Addon } from "../../types";
import { StatusPill } from "../common/StatusPill";

export function InstalledAddonRow({ addon, isSelected, disabled, onToggle }: { addon: Addon; isSelected: boolean; disabled: boolean; onToggle: () => void }) {
  const statusTone = addon.health === "需要修复" ? "warning" : addon.health === "运行正常" ? "success" : "neutral";
  const dotStyle = addon.health === "需要修复" ? "bg-amber-500" : addon.health === "运行正常" ? "bg-emerald-500" : "bg-slate-400";
  return <div className="grid grid-cols-[44px_minmax(180px,1.8fr)_82px_120px_102px] items-center px-3 py-3 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
    <label className="grid size-9 cursor-pointer place-items-center"><input className="size-5 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" aria-label={`选择${addon.name}`} disabled={disabled} type="checkbox" checked={isSelected} onChange={onToggle} /></label>
    <span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600 dark:bg-brand-600/15"><FileTextIcon size={20} /></span><span className="min-w-0"><strong className="block truncate font-semibold">{addon.name}</strong><small className="mt-0.5 block truncate text-slate-500">{addon.description}</small></span></span>
    <span>{addon.version}</span>
    <span className="text-slate-500 dark:text-slate-400">{addon.source}</span>
    <span><StatusPill tone={statusTone}><span className={`size-1.5 rounded-full ${dotStyle}`} />{addon.health}</StatusPill></span>
  </div>;
}
