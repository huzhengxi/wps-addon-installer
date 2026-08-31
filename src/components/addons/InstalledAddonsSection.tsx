import { PuzzlePieceIcon, TrashIcon } from "@phosphor-icons/react";
import type { Addon } from "../../types";
import { InstalledAddonRow } from "./InstalledAddonRow";

export function InstalledAddonsSection({ installed, selected, setSelected, isUninstalling, onUninstall }: { installed: Addon[]; selected: string[]; setSelected: (value: string[]) => void; isUninstalling: boolean; onUninstall: () => void }) {
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  return <section className="mt-7">
    <div className="mb-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5"><h3 className="text-base font-semibold">已安装</h3>{installed.length > 0 && <span className="text-xs text-slate-400">选择后可批量卸载</span>}</div>
      <span className="text-xs font-medium text-slate-400">{installed.length} 个插件</span>
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02] dark:border-slate-800 dark:bg-slate-900">
      {installed.length > 0 ? <><div className="grid grid-cols-[44px_minmax(180px,1.8fr)_82px_120px_102px] items-center border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-800/30">
        <label className="grid size-9 cursor-pointer place-items-center"><input className="size-5 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" aria-label="选择全部已安装插件" disabled={isUninstalling} type="checkbox" checked={installed.length > 0 && selected.length === installed.length} onChange={() => setSelected(selected.length === installed.length ? [] : installed.map((item) => item.id))} /></label>
        <span>名称</span><span>版本</span><span>来源</span><span>状态</span>
      </div>
      {installed.map((addon) => <InstalledAddonRow key={addon.id} addon={addon} isSelected={selected.includes(addon.id)} disabled={isUninstalling} onToggle={() => toggle(addon.id)} />)}</> : <div className="grid place-items-center px-6 py-7 text-center"><span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><PuzzlePieceIcon size={20} /></span><p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">还没有已安装插件</p><p className="mt-1 text-xs text-slate-400">安装后会在这里显示版本与运行状态</p></div>}
    </div>
    {selected.length > 0 && <div className="sticky bottom-0 mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
      <span className="text-sm font-semibold">{isUninstalling ? "正在卸载所选插件…" : `已选择 ${selected.length} 项`}</span>
      <button type="button" disabled={isUninstalling} onClick={onUninstall} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-rose-950/30"><TrashIcon size={18} />卸载</button>
    </div>}
  </section>;
}
