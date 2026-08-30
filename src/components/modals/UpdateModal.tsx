import type { AppUpdateInfo } from "../../api";
import { Modal } from "../common/Modal";
import { Spinner } from "../common/Spinner";

export function UpdateModal({ update, isInstalling, onClose, onConfirm }: { update: AppUpdateInfo; isInstalling: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal title="发现新版本" onClose={() => !isInstalling && onClose()}>
    <div className="mt-3 rounded-xl bg-brand-50 p-4 dark:bg-brand-600/10">
      <p className="text-sm font-bold text-brand-700 dark:text-brand-200">安装器 {update.version} 已准备好</p>
      {update.notes && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{update.notes}</p>}
    </div>
    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">更新完成后应用会自动重新打开。</p>
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" disabled={isInstalling} onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">稍后</button>
      <button type="button" disabled={isInstalling} onClick={onConfirm} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-70"><Spinner size={17} spin={isInstalling} />{isInstalling ? "正在更新…" : "立即更新"}</button>
    </div>
  </Modal>;
}
