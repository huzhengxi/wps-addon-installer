import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { Modal } from "../common/Modal";

export function UninstallConfirmModal({ count, isUninstalling, onClose, onConfirm }: { count: number; isUninstalling: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal title="卸载所选插件？" closeDisabled={isUninstalling} onClose={() => !isUninstalling && onClose()}>
    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">将移除 {count} 个插件文件，并定向删除对应的 WPS 配置项。其他插件不会受到影响。</p>
    {isUninstalling && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><ArrowClockwiseIcon size={18} className="animate-spin" />正在卸载插件，请稍候…</p>}
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" disabled={isUninstalling} onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">取消</button>
      <button type="button" disabled={isUninstalling} onClick={onConfirm} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70"><ArrowClockwiseIcon size={17} className={isUninstalling ? "animate-spin" : "hidden"} />{isUninstalling ? "正在卸载…" : "卸载"}</button>
    </div>
  </Modal>;
}
