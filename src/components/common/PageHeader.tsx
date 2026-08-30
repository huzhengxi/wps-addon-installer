import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action = null, descriptionClassName = "mt-2 text-sm text-slate-500 dark:text-slate-400" }: { eyebrow: string; title: string; description: string; action?: ReactNode; descriptionClassName?: string }) {
  return <header className="flex items-start justify-between gap-6">
    <div>
      <p className="text-xs font-bold tracking-[0.12em] text-brand-600">{eyebrow}</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight">{title}</h2>
      <p className={descriptionClassName}>{description}</p>
    </div>
    {action}
  </header>;
}
