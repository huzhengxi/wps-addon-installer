import { CheckCircleIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import type { Notice } from "../../hooks/useNotice";

export function NoticeBanner({ notice, onDismiss }: { notice: NonNullable<Notice>; onDismiss: () => void }) {
  const styles = notice.tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
    : notice.tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  return <div role="status" className={`mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${styles}`}>
    <span className="flex gap-2">{notice.tone === "success" ? <CheckCircleIcon size={19} weight="fill" /> : <WarningCircleIcon size={19} weight="fill" />}{notice.text}</span>
    <button type="button" onClick={onDismiss} aria-label="关闭提示"><XIcon size={17} /></button>
  </div>;
}
