import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { APP_VERSION, navItems } from "../../constants";
import type { Page, WpsConnectionState } from "../../types";

const wpsConnectionPresentation: Record<WpsConnectionState, { label: string; dotClassName: string }> = {
  checking: { label: "正在检测 WPS…", dotClassName: "bg-slate-400" },
  connected: { label: "WPS 已连接", dotClassName: "bg-emerald-500" },
  "not-found": { label: "未检测到 WPS", dotClassName: "bg-rose-500" },
  unsupported: { label: "WPS 版本不支持", dotClassName: "bg-amber-500" },
  error: { label: "WPS 状态未知", dotClassName: "bg-amber-500" }
};

export function Sidebar({ page, onNavigate, permissionNeedsAttention, wpsConnectionState, isCheckingUpdate, onCheckUpdate }: { page: Page; onNavigate: (page: Page) => void; permissionNeedsAttention: boolean; wpsConnectionState: WpsConnectionState; isCheckingUpdate: boolean; onCheckUpdate: () => void }) {
  const wpsConnection = wpsConnectionPresentation[wpsConnectionState];
  return <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-[#151b26]">
    <div className="mb-10 flex items-center gap-3 px-2">
      <div className="grid size-11 place-items-center rounded-xl bg-brand-600 text-xl font-black text-white shadow-lg shadow-brand-600/25">日</div>
      <div><p className="text-[11px] font-bold tracking-[0.12em] text-brand-600">WPS 表格加载项</p><h1 className="text-base font-bold">插件管理器</h1></div>
    </div>
    <nav aria-label="主导航" className="grid gap-1">
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = page === id || (id === "help" && page === "help-document");
        return <button key={id} type="button" onClick={() => onNavigate(id)} className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${active ? "bg-brand-100 text-brand-700 dark:bg-brand-600/25 dark:text-brand-100" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"}`}>
          <Icon size={21} weight={active ? "fill" : "regular"} />{label}
          {id === "permissions" && permissionNeedsAttention && <span aria-label="权限需要处理" className="absolute right-3 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#151b26]" />}
        </button>;
      })}
    </nav>
    <div className="mt-auto border-t border-slate-200 px-2 pt-5 dark:border-slate-800">
      <p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><span className={`size-2 rounded-full ${wpsConnection.dotClassName}`} />{wpsConnection.label}</p>
      <p className="mt-2 text-xs text-slate-400">安装器 v{APP_VERSION}</p>
      <button type="button" onClick={onCheckUpdate} disabled={isCheckingUpdate} className="mt-4 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 disabled:cursor-wait disabled:opacity-70 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-200">
        <ArrowClockwiseIcon size={16} className={isCheckingUpdate ? "animate-spin" : ""} />{isCheckingUpdate ? "正在检查更新…" : "检查应用更新"}
      </button>
    </div>
  </aside>;
}
