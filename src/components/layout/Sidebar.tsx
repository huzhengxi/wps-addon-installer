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
  return <aside className="flex min-h-0 flex-col border-r border-slate-200/80 bg-[#fcfcfe] px-3 py-4 dark:border-slate-800 dark:bg-[#141923]">
    <div className="mb-7 flex items-center gap-2.5 px-2 py-1">
      <div className="grid size-9 place-items-center rounded-[10px] bg-brand-600 text-base font-black text-white shadow-sm">日</div>
      <div className="min-w-0"><p className="truncate text-[10px] font-semibold tracking-[0.08em] text-brand-600 dark:text-brand-300">WPS 表格加载项</p><h1 className="truncate text-[15px] font-semibold">插件管理器</h1></div>
    </div>
    <nav aria-label="主导航" className="grid gap-1">
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = page === id || (id === "help" && page === "help-document");
        return <button key={id} type="button" onClick={() => onNavigate(id)} className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-offset-[-2px] ${active ? "bg-brand-50 text-brand-700 shadow-[inset_3px_0_0_#6954db] dark:bg-brand-600/15 dark:text-brand-100" : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100"}`}>
          <Icon size={20} weight={active ? "fill" : "regular"} />{label}
          {id === "permissions" && permissionNeedsAttention && <span aria-label="权限需要处理" className="absolute right-3 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#151b26]" />}
        </button>;
      })}
    </nav>
    <div className="mt-auto rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300"><span className={`size-2 rounded-full ${wpsConnection.dotClassName}`} />{wpsConnection.label}</p>
      <p className="mt-1.5 text-[11px] text-slate-400">安装器 v{APP_VERSION}</p>
      <button type="button" onClick={onCheckUpdate} disabled={isCheckingUpdate} className="mt-2.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 disabled:cursor-wait disabled:opacity-70 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-200">
        <ArrowClockwiseIcon size={16} className={isCheckingUpdate ? "animate-spin" : ""} />{isCheckingUpdate ? "正在检查更新…" : "检查应用更新"}
      </button>
    </div>
  </aside>;
}
