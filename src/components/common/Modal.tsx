import type { ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";

export function Modal({ title, children, onClose, closeDisabled = false }: { title: string; children: ReactNode; onClose: () => void; closeDisabled?: boolean }) {
  return createPortal(<div className="fixed inset-0 z-20 grid h-screen w-screen place-items-center bg-slate-950/40 p-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4"><h2 id="modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><IconButton label="关闭" disabled={closeDisabled} onClick={onClose}><XIcon size={18} /></IconButton></div>
      {children}
    </section>
  </div>, document.body);
}
