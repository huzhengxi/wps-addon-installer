import type { EnvironmentReport } from "../../api";
import type { Addon } from "../../types";
import { PageHeader } from "../common/PageHeader";
import { SearchInput } from "../common/SearchInput";
import { Spinner } from "../common/Spinner";
import { AvailableAddonsSection } from "./AvailableAddonsSection";
import { EnvironmentBanner } from "./EnvironmentBanner";
import { InstalledAddonsSection } from "./InstalledAddonsSection";

export function AddonsPage({ installed, available, query, selected, environment, environmentError, isUninstalling, isRefreshing, installingAddonId, setQuery, setSelected, install, onRefresh, onOpenPermissions, onUninstall }: {
  installed: Addon[];
  available: Addon[];
  query: string;
  selected: string[];
  environment: EnvironmentReport | null;
  environmentError: string | null;
  isUninstalling: boolean;
  isRefreshing: boolean;
  installingAddonId: string | null;
  setQuery: (value: string) => void;
  setSelected: (value: string[]) => void;
  install: (id: string) => void;
  onRefresh: () => void;
  onOpenPermissions: () => void;
  onUninstall: () => void;
}) {
  return <>
    <PageHeader
      eyebrow="WPS 插件"
      title="插件"
      description="管理 WPS 中的加载项"
      action={<button type="button" onClick={onRefresh} disabled={isRefreshing || Boolean(installingAddonId) || isUninstalling} aria-busy={isRefreshing} className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:text-brand-700 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Spinner size={17} spin={isRefreshing} />{isRefreshing ? "刷新中…" : "刷新"}</button>}
    />
    <EnvironmentBanner environment={environment} environmentError={environmentError} onOpenPermissions={onOpenPermissions} />
    <div className="mt-5 flex items-center justify-between gap-4">
      <SearchInput value={query} onChange={setQuery} placeholder="搜索插件" labelClassName="w-full max-w-sm" inputClassName="py-2.5 placeholder:text-slate-400" />
      <p className="shrink-0 text-xs text-slate-400">来源更新后自动显示新版本</p>
    </div>
    <InstalledAddonsSection installed={installed} selected={selected} setSelected={setSelected} isUninstalling={isUninstalling} onUninstall={onUninstall} />
    <AvailableAddonsSection available={available} installed={installed} query={query} isRefreshing={isRefreshing} installingAddonId={installingAddonId} install={install} />
  </>;
}
