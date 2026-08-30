import { useState } from "react";
import type { SourceDraft } from "../../hooks/useControlSources";
import { Modal } from "../common/Modal";

export function AddSourceModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (draft: SourceDraft) => Promise<boolean> }) {
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>({ name: "", url: "" });
  const submit = () => {
    void onConfirm(sourceDraft).then((saved) => {
      if (saved) onClose();
    });
  };
  return <Modal title="添加控件源" onClose={onClose}>
    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">只添加你信任的 HTTPS 索引地址。保存后默认停用，需要测试连接后再启用。</p>
    <label className="mt-5 block text-sm font-semibold">名称<input value={sourceDraft.name} onChange={(event) => setSourceDraft({ ...sourceDraft, name: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none dark:border-slate-700 dark:bg-slate-950" placeholder="例如：团队内部控件源" /></label>
    <label className="mt-4 block text-sm font-semibold">索引 URL<input value={sourceDraft.url} onChange={(event) => setSourceDraft({ ...sourceDraft, url: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none dark:border-slate-700 dark:bg-slate-950" placeholder="https://example.com/v1/index.json" /></label>
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">取消</button>
      <button type="button" onClick={submit} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">保存为停用</button>
    </div>
  </Modal>;
}
