import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action = null, descriptionClassName = "mt-2 text-sm text-slate-500 dark:text-slate-400" }: { eyebrow: string; title: string; description: string; action?: ReactNode; descriptionClassName?: string }) {
  return <header className="flex items-start justify-between gap-6">
    <div>
      <p className="text-[11px] font-semibold tracking-[0.08em] text-brand-600 dark:text-brand-300">{eyebrow}</p>
      <h2 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{title}</h2>
      <p className={descriptionClassName}>{description}</p>
    </div>
    {action && <div className="shrink-0 pt-1">{action}</div>}
  </header>;
}
