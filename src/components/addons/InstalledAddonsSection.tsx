import { TrashIcon } from "@phosphor-icons/react";
import type { Addon } from "../../types";
import { InstalledAddonRow } from "./InstalledAddonRow";

export function InstalledAddonsSection({ installed, selected, setSelected, isUninstalling, onUninstall }: { installed: Addon[]; selected: string[]; setSelected: (value: string[]) => void; isUninstalling: boolean; onUninstall: () => void }) {
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  return <section className="mt-8">
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-3"><h3 className="text-lg font-bold">已安装</h3><span className="text-xs font-medium text-slate-400">选中可卸载</span></div>
      <span className="text-sm text-slate-500">{installed.length} 个插件</span>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-[44px_minmax(210px,1.8fr)_100px_140px_110px] items-center border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-400 dark:border-slate-800">
        <label className="grid size-9 cursor-pointer place-items-center"><input className="size-5 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" aria-label="选择全部已安装插件" disabled={isUninstalling} type="checkbox" checked={installed.length > 0 && selected.length === installed.length} onChange={() => setSelected(selected.length === installed.length ? [] : installed.map((item) => item.id))} /></label>
        <span>名称</span><span>版本</span><span>来源</span><span>状态</span>
      </div>
      {installed.map((addon) => <InstalledAddonRow key={addon.id} addon={addon} isSelected={selected.includes(addon.id)} disabled={isUninstalling} onToggle={() => toggle(addon.id)} />)}
    </div>
    {selected.length > 0 && <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <span className="text-sm font-semibold">{isUninstalling ? "正在卸载所选插件…" : `已选择 ${selected.length} 项`}</span>
      <button type="button" disabled={isUninstalling} onClick={onUninstall} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-rose-950/30"><TrashIcon size={18} />卸载</button>
    </div>}
  </section>;
}
