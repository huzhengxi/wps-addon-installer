import { ArrowLeftIcon } from "@phosphor-icons/react";
import { helpGuides, MarkdownDocument } from "../../help-guides";

export function HelpDocumentPage({ guideId, onBack, onNavigate }: { guideId: string; onBack: () => void; onNavigate: (guideId: string) => void }) {
  const guide = helpGuides.find((item) => item.id === guideId) ?? helpGuides[0];
  return <>
    <header className="sticky -top-8 z-10 -mx-8 -mt-8 border-b border-slate-200 bg-[#f5f6fa] px-8 pt-5 pb-4 shadow-sm dark:border-slate-800 dark:bg-[#11151e]">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-600/10"><ArrowLeftIcon size={18} />返回帮助目录</button>
      <p className="mt-4 text-xs font-bold tracking-[0.12em] text-brand-600">离线帮助</p>
      <h2 className="mt-1 text-3xl font-bold tracking-tight">{guide.title}</h2>
    </header>
    <article className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><MarkdownDocument content={guide.content} onNavigate={onNavigate} /></article>
  </>;
}
