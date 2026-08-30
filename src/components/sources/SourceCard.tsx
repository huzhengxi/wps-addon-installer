import { LinkIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import type { ControlSource } from "../../api";
import { IconButton } from "../common/IconButton";
import { Spinner } from "../common/Spinner";
import { StatusPill } from "../common/StatusPill";

export function SourceCard({ source, isTesting, onTest, onToggle }: { source: ControlSource; isTesting: boolean; onTest: (id: string) => void; onToggle: (source: ControlSource) => void }) {
  return <article className="flex items-center gap-4 border-b border-slate-100 p-5 last:border-0 dark:border-slate-800">
    <span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LinkIcon size={22} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2"><h3 className="font-bold">{source.name}</h3>{source.defaultSource && <StatusPill>默认源</StatusPill>}<StatusPill tone={source.enabled ? "success" : "neutral"}>{source.enabled ? "已启用" : "已停用"}</StatusPill></div>
      <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{source.indexUrl}</p>
      <p className="mt-2 text-xs text-slate-400">最近同步：{source.lastSyncedAt ?? "尚未同步"}</p>
    </div>
    <button type="button" disabled={isTesting} aria-busy={isTesting} onClick={() => onTest(source.id)} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-brand-600 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70 dark:text-brand-300 dark:hover:bg-brand-600/10">
      {isTesting && <Spinner size={16} />}{isTesting ? "测试中…" : "测试连接"}
    </button>
    <button type="button" onClick={() => onToggle(source)} className={`relative h-7 w-12 rounded-full transition ${source.enabled ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`} aria-label={`${source.enabled ? "停用" : "启用"}${source.name}`}><span className={`absolute top-1 size-5 rounded-full bg-white transition ${source.enabled ? "left-6" : "left-1"}`} /></button>
    {!source.defaultSource && <IconButton label={`编辑${source.name}`}><PencilSimpleIcon size={18} /></IconButton>}
  </article>;
}
