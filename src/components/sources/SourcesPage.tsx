import { InfoIcon, PlusIcon } from "@phosphor-icons/react";
import type { ControlSource } from "../../api";
import { PageHeader } from "../common/PageHeader";
import { SourceCard } from "./SourceCard";

export function SourcesPage({ sources, testingSourceIds, onAdd, onTest, onToggle }: { sources: ControlSource[]; testingSourceIds: ReadonlySet<string>; onAdd: () => void; onTest: (id: string) => void; onToggle: (source: ControlSource) => void }) {
  return <>
    <PageHeader
      eyebrow="插件分发"
      title="控件源"
      description="控件源提供插件列表与下载地址。只添加你信任的 HTTPS 地址。"
      action={<button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"><PlusIcon size={18} />添加控件源</button>}
    />
    <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {sources.map((source) => <SourceCard key={source.id} source={source} isTesting={testingSourceIds.has(source.id)} onTest={onTest} onToggle={onToggle} />)}
    </div>
    <p className="mt-4 flex gap-2 text-sm text-slate-500 dark:text-slate-400"><InfoIcon className="mt-0.5 shrink-0" size={18} />同名插件按控件源优先级处理；首版只从已启用的可信源下载，并在安装前校验 SHA-256。</p>
  </>;
}
