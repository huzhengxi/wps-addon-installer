import { useState } from "react";
import { ClipboardTextIcon } from "@phosphor-icons/react";
import { helpGuides } from "../../help-guides";
import { PageHeader } from "../common/PageHeader";
import { SearchInput } from "../common/SearchInput";

export function HelpPage({ onOpen }: { onOpen: (guideId: string) => void }) {
  const [query, setQuery] = useState("");
  const visibleGuides = helpGuides.filter((guide) => `${guide.title}\n${guide.content}`.includes(query.trim()));
  return <>
    <PageHeader eyebrow="离线帮助" title="帮助" description="内容直接来自项目的用户手册。" />
    <SearchInput value={query} onChange={setQuery} placeholder="搜索用户手册" labelClassName="mt-7 max-w-xl" inputClassName="py-3" />
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {visibleGuides.length ? visibleGuides.map((guide) => <button type="button" key={guide.id} onClick={() => onOpen(guide.id)} className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-4 text-left text-sm font-semibold transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"><ClipboardTextIcon className="text-brand-600" size={20} />{guide.title}</button>) : <p className="px-5 py-4 text-sm text-slate-500">未找到匹配的帮助条目。</p>}
    </div>
  </>;
}
