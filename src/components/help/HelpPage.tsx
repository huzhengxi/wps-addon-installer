import { useState } from "react";
import { CaretRightIcon, ClipboardTextIcon } from "@phosphor-icons/react";
import { helpGuides } from "../../help-guides";
import { PageHeader } from "../common/PageHeader";
import { SearchInput } from "../common/SearchInput";

export function HelpPage({ onOpen }: { onOpen: (guideId: string) => void }) {
  const [query, setQuery] = useState("");
  const visibleGuides = helpGuides.filter((guide) => `${guide.title}\n${guide.content}`.includes(query.trim()));
  return <>
    <PageHeader eyebrow="离线帮助" title="帮助" description="内容直接来自项目的用户手册。" />
    <SearchInput value={query} onChange={setQuery} placeholder="搜索用户手册" labelClassName="mt-6 max-w-xl" inputClassName="py-2.5" />
    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02] dark:border-slate-800 dark:bg-slate-900">
      {visibleGuides.length ? visibleGuides.map((guide) => <button type="button" key={guide.id} onClick={() => onOpen(guide.id)} className="group flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm font-medium transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"><span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-300"><ClipboardTextIcon size={18} /></span><span className="flex-1">{guide.title}</span><CaretRightIcon className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" size={16} /></button>) : <p className="px-5 py-4 text-sm text-slate-500">未找到匹配的帮助条目。</p>}
    </div>
  </>;
}
