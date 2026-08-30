import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwiseIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  DatabaseIcon,
  DotsThreeVerticalIcon,
  DownloadSimpleIcon,
  FileTextIcon,
  InfoIcon,
  LinkIcon,
  LockKeyIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  PuzzlePieceIcon,
  QuestionIcon,
  ShieldCheckIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon
} from "@phosphor-icons/react";
import {
  addControlSource,
  checkAppUpdate,
  inspectEnvironment,
  inspectPermissions,
  installCatalogAddon,
  installAppUpdateAndRestart,
  listInstalledAddons,
  listCatalogAddons,
  listControlSources,
  openPermissionSettings,
  setControlSourceEnabled,
  testControlSource,
  uninstallSelectedAddon,
  type ControlSource,
  type AppUpdateInfo,
  type EnvironmentReport,
  type PermissionReport
} from "./api";

type Page = "addons" | "sources" | "permissions" | "help";
type Notice = { tone: "success" | "warning" | "error"; text: string } | null;

type Addon = {
  id: string;
  name: string;
  description: string;
  version: string;
  source: string;
  installed: boolean;
  health: "运行正常" | "需要修复" | "外部安装";
  sourceId?: string;
};

const initialAddons: Addon[] = [];

const initialSources: ControlSource[] = [
  { id: "official", name: "官方控件源", indexUrl: "https://huzhengxi.github.io/wps-addon-catalog/v1/index.json", enabled: true, defaultSource: true, lastSyncedAt: null },
  { id: "gitee", name: "Gitee 镜像", indexUrl: "https://gitee.com/example/wps-addon-catalog/releases", enabled: false, defaultSource: false, lastSyncedAt: null }
];

const navItems = [
  { id: "addons" as const, label: "插件", icon: PuzzlePieceIcon },
  { id: "sources" as const, label: "控件源", icon: DatabaseIcon },
  { id: "permissions" as const, label: "权限", icon: ShieldCheckIcon },
  { id: "help" as const, label: "帮助", icon: QuestionIcon }
];

function IconButton({ label, children, onClick, disabled = false }: { label: string; children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">{children}</button>;
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" }) {
  const styles = tone === "success"
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
    : tone === "warning"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}

function Modal({ title, children, onClose, closeDisabled = false }: { title: string; children: React.ReactNode; onClose: () => void; closeDisabled?: boolean }) {
  return <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/45 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4"><h2 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2><IconButton label="关闭" disabled={closeDisabled} onClick={onClose}><XIcon size={18} /></IconButton></div>
      {children}
    </section>
  </div>;
}

export function App() {
  const [page, setPage] = useState<Page>("addons");
  const [addons, setAddons] = useState(initialAddons);
  const [sources, setSources] = useState<ControlSource[]>(initialSources);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [modal, setModal] = useState<"source" | "uninstall" | "update" | null>(null);
  const [sourceDraft, setSourceDraft] = useState({ name: "", url: "" });
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionReport, setPermissionReport] = useState<PermissionReport | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentReport | null>(null);
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [installingAddonId, setInstallingAddonId] = useState<string | null>(null);

  const installed = addons.filter((addon) => addon.installed);
  const available = useMemo(() => addons.filter((addon) => !addon.installed && addon.name.includes(query.trim())), [addons, query]);
  const installingAddon = addons.find((addon) => addon.id === installingAddonId) ?? null;
  const permissionNeedsAttention = permissionReport !== null && (!permissionReport.wpsFound || !permissionReport.wpsPathReadable || !permissionReport.jsaddonsWritable);
  const notify = (tone: NonNullable<Notice>["tone"], text: string) => setNotice({ tone, text });

  useEffect(() => {
    void listControlSources().then(setSources).catch(() => undefined);
    void listCatalogAddons().then((report) => {
      setAddons((items) => {
        const installedItems = items.filter((item) => item.installed);
        return [...installedItems, ...report.addons.map((addon) => ({
          id: addon.id,
          name: addon.name,
          description: addon.description || "来自控件源的 WPS 表格插件",
          version: addon.version,
          source: addon.sourceName,
          installed: false,
          health: "运行正常" as const
          , sourceId: addon.sourceId
        }))];
      });
      if (report.warnings.length > 0) notify("warning", report.warnings[0]);
    }).catch(() => undefined);
    void listInstalledAddons().then((report) => {
      setAddons((items) => [
        ...report.map((addon) => ({
          ...addon,
          description: "已部署到 WPS 加载项目录",
          installed: true,
          health: addon.health === "需要修复" ? "需要修复" as const : "运行正常" as const
        })),
        ...items.filter((item) => !item.installed)
      ]);
    }).catch(() => undefined);
    void inspectPermissions().then((report) => {
      setPermissionReport(report);
      setPermissionGranted(report.jsaddonsWritable);
    }).catch(() => undefined);
    void inspectEnvironment().then(setEnvironment).catch(() => undefined);
    void checkAppUpdate().then((report) => {
      if (report.update) {
        setUpdate(report.update);
        setModal("update");
      }
    }).catch(() => undefined);
  }, []);

  const checkForUpdate = () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    void checkAppUpdate()
      .then((report) => {
        if (report.update) {
          setUpdate(report.update);
          setModal("update");
        } else {
          notify("success", "当前已是最新版本。");
        }
      })
      .catch(() => notify("warning", "暂时无法检查更新，请稍后重试。"))
      .finally(() => setIsCheckingUpdate(false));
  };

  const installUpdate = () => {
    setIsInstallingUpdate(true);
    void installAppUpdateAndRestart()
      .catch(() => {
        setIsInstallingUpdate(false);
        notify("error", "更新下载失败，请稍后重试。");
      });
  };

  const install = (id: string) => {
    if (installingAddonId) return;
    const addon = addons.find((item) => item.id === id);
    if (!addon) return;
    if (!addon.sourceId) {
      notify("warning", `“${addon.name}”不是来自可用控件源，无法在线安装。`);
      return;
    }
    setInstallingAddonId(id);
    void installCatalogAddon(addon.sourceId, addon.id)
      .then((report) => {
        setAddons((items) => items.map((item) => item.id === id ? { ...item, installed: true } : item));
        notify("success", report.message);
      })
      .catch((error: unknown) => notify("error", error instanceof Error ? error.message : "插件安装失败。"))
      .finally(() => setInstallingAddonId(null));
  };
  const uninstallSelected = () => {
    if (isUninstalling) return;
    const selectedAddons = addons.filter((item) => selected.includes(item.id) && item.installed);
    if (selectedAddons.length === 0) {
      notify("warning", "请选择至少一个已安装插件。 ");
      return;
    }
    setIsUninstalling(true);
    void (async () => {
      for (const addon of selectedAddons) await uninstallSelectedAddon(addon.id, addon.version);
    })()
      .then(() => {
        const removed = new Set(selectedAddons.map((addon) => `${addon.id}@${addon.version}`));
        // Installed entries are local scan results and do not carry a sourceId.
        // Remove them after deletion instead of turning them into installable
        // entries; any matching catalog entry remains and can be installed.
        setAddons((items) => items.filter((item) => !item.installed || !removed.has(`${item.id}@${item.version}`)));
        setSelected([]);
        setModal(null);
        notify("success", `已卸载 ${selectedAddons.length} 个插件。`);
      })
      .catch((error: unknown) => notify("error", error instanceof Error ? error.message : "插件卸载失败。"))
      .finally(() => setIsUninstalling(false));
  };
  const addSource = async () => {
    if (!sourceDraft.name.trim() || !sourceDraft.url.startsWith("https://")) {
      notify("error", "请输入名称和 HTTPS 索引地址。");
      return;
    }
    try {
      const source = await addControlSource({ name: sourceDraft.name.trim(), indexUrl: sourceDraft.url.trim() });
      setSources((items) => [...items, source]);
    } catch {
      setSources((items) => [...items, { id: crypto.randomUUID(), name: sourceDraft.name.trim(), indexUrl: sourceDraft.url.trim(), enabled: false, defaultSource: false, lastSyncedAt: "未启用" }]);
    }
    setSourceDraft({ name: "", url: "" });
    setModal(null);
    notify("success", "控件源已保存为停用状态，请测试连接后再启用。");
  };

  return <main className="grid h-full grid-cols-[216px_minmax(0,1fr)] bg-[#f5f6fa] text-slate-900 dark:bg-[#11151e] dark:text-slate-100">
    <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-[#151b26]">
      <div className="mb-10 flex items-center gap-3 px-2"><div className="grid size-11 place-items-center rounded-xl bg-brand-600 text-xl font-black text-white shadow-lg shadow-brand-600/25">日</div><div><p className="text-[11px] font-bold tracking-[0.12em] text-brand-600">WPS 表格加载项</p><h1 className="text-base font-bold">插件管理器</h1></div></div>
      <nav aria-label="主导航" className="grid gap-1">{navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setPage(id)} className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${page === id ? "bg-brand-100 text-brand-700 dark:bg-brand-600/25 dark:text-brand-100" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"}`}><Icon size={21} weight={page === id ? "fill" : "regular"} />{label}{id === "permissions" && permissionNeedsAttention && <span aria-label="权限需要处理" className="absolute right-3 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#151b26]" />}</button>)}</nav>
      <div className="mt-auto border-t border-slate-200 px-2 pt-5 dark:border-slate-800"><p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><span className="size-2 rounded-full bg-emerald-500" />WPS 已连接</p><p className="mt-2 text-xs text-slate-400">安装器 v0.1.0</p><button type="button" onClick={checkForUpdate} disabled={isCheckingUpdate} className="mt-4 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 disabled:cursor-wait disabled:opacity-70 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-200"><ArrowClockwiseIcon size={16} className={isCheckingUpdate ? "animate-spin" : ""} />{isCheckingUpdate ? "正在检查更新…" : "检查应用更新"}</button></div>
    </aside>

    <section className="min-w-0 overflow-auto p-8">
      {installingAddon && <div role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:border-brand-600/30 dark:bg-brand-600/10 dark:text-brand-100"><ArrowClockwiseIcon size={19} className="animate-spin" />正在安装“{installingAddon.name}”，正在下载、校验并部署插件，请稍候…</div>}
      {notice && <div role="status" className={`mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : notice.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"}`}><span className="flex gap-2">{notice.tone === "success" ? <CheckCircleIcon size={19} weight="fill" /> : <WarningCircleIcon size={19} weight="fill" />}{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="关闭提示"><XIcon size={17} /></button></div>}
      {page === "addons" && <AddonsPage addons={addons} installed={installed} available={available} query={query} selected={selected} environment={environment} isUninstalling={isUninstalling} installingAddonId={installingAddonId} setQuery={setQuery} setSelected={setSelected} install={install} onUninstall={() => setModal("uninstall")} />}
      {page === "sources" && <SourcesPage sources={sources} setSources={setSources} add={() => setModal("source")} notify={notify} />}
      {page === "permissions" && <PermissionsPage report={permissionReport} granted={permissionGranted} onApply={() => { void inspectPermissions().then((report) => { setPermissionReport(report); setPermissionGranted(report.jsaddonsWritable); notify(report.jsaddonsWritable ? "success" : "warning", report.guidance); }).catch(() => notify("warning", "当前系统未返回权限状态，请按下方步骤在系统设置中完成授权。")); }} onOpenSettings={() => { void openPermissionSettings().then(() => notify("success", "系统权限设置已打开。完成授权后请返回此页重新检测。")).catch(() => notify("warning", "无法自动打开系统设置，请按下方步骤手动开启权限。")); }} />}
      {page === "help" && <HelpPage />}
    </section>

    {modal === "source" && <Modal title="添加控件源" onClose={() => setModal(null)}><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">只添加你信任的 HTTPS 索引地址。保存后默认停用，需要测试连接后再启用。</p><label className="mt-5 block text-sm font-semibold">名称<input value={sourceDraft.name} onChange={(event) => setSourceDraft({ ...sourceDraft, name: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none dark:border-slate-700 dark:bg-slate-950" placeholder="例如：团队内部控件源" /></label><label className="mt-4 block text-sm font-semibold">索引 URL<input value={sourceDraft.url} onChange={(event) => setSourceDraft({ ...sourceDraft, url: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none dark:border-slate-700 dark:bg-slate-950" placeholder="https://example.com/v1/index.json" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">取消</button><button type="button" onClick={addSource} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">保存为停用</button></div></Modal>}
    {modal === "uninstall" && <Modal title="卸载所选插件？" closeDisabled={isUninstalling} onClose={() => !isUninstalling && setModal(null)}><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">将移除 {selected.length} 个插件文件，并定向删除对应的 WPS 配置项。其他插件不会受到影响。</p>{isUninstalling && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><ArrowClockwiseIcon size={18} className="animate-spin" />正在卸载插件，请稍候…</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isUninstalling} onClick={() => setModal(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">取消</button><button type="button" disabled={isUninstalling} onClick={uninstallSelected} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70"><ArrowClockwiseIcon size={17} className={isUninstalling ? "animate-spin" : "hidden"} />{isUninstalling ? "正在卸载…" : "卸载"}</button></div></Modal>}
    {modal === "update" && update && <Modal title="发现新版本" onClose={() => !isInstallingUpdate && setModal(null)}><div className="mt-3 rounded-xl bg-brand-50 p-4 dark:bg-brand-600/10"><p className="text-sm font-bold text-brand-700 dark:text-brand-200">安装器 {update.version} 已准备好</p>{update.notes && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{update.notes}</p>}</div><p className="mt-4 text-sm text-slate-500 dark:text-slate-400">更新完成后应用会自动重新打开。</p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isInstallingUpdate} onClick={() => setModal(null)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">稍后</button><button type="button" disabled={isInstallingUpdate} onClick={installUpdate} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-70"><ArrowClockwiseIcon size={17} className={isInstallingUpdate ? "animate-spin" : ""} />{isInstallingUpdate ? "正在更新…" : "立即更新"}</button></div></Modal>}
  </main>;
}

function AddonsPage({ addons, installed, available, query, selected, environment, isUninstalling, installingAddonId, setQuery, setSelected, install, onUninstall }: { addons: Addon[]; installed: Addon[]; available: Addon[]; query: string; selected: string[]; environment: EnvironmentReport | null; isUninstalling: boolean; installingAddonId: string | null; setQuery: (value: string) => void; setSelected: (value: string[]) => void; install: (id: string) => void; onUninstall: () => void }) {
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const environmentPassed = Boolean(environment?.wpsInstalled && environment.wpsVersionSupported);
  const environmentMessage = environment
    ? environmentPassed
      ? `环境检查通过 · WPS ${environment.wpsVersion}`
      : environment.wpsInstalled
        ? `WPS ${environment.wpsVersion ?? "版本读取失败"} 不满足最低要求 ${environment.wpsMinimumVersion}`
        : "未检测到 WPS Office"
    : "正在检查 WPS 环境…";
  return <><header className="flex items-start justify-between gap-6"><div><p className="text-xs font-bold tracking-[0.12em] text-brand-600">WPS 插件</p><h2 className="mt-1 text-3xl font-bold tracking-tight">插件</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">管理 WPS 中的加载项</p></div><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 transition hover:border-brand-200 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><ArrowClockwiseIcon size={18} />刷新</button></header>
    <div className={`mt-7 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${environmentPassed ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-600/30 dark:bg-brand-600/10 dark:text-brand-100" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"}`}><CheckCircleIcon size={19} weight="fill" />{environmentMessage}</div>
    <div className="mt-7 flex items-center justify-between gap-4"><label className="relative block w-full max-w-sm"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索插件" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900" /></label><p className="shrink-0 text-xs text-slate-400">来源更新后自动显示新版本</p></div>
    <section className="mt-8"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">已安装</h3><span className="text-sm text-slate-500">{installed.length} 个插件</span></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="grid grid-cols-[36px_minmax(210px,1.8fr)_100px_140px_110px_40px] items-center border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-400 dark:border-slate-800"><span><input aria-label="选择全部已安装插件" disabled={isUninstalling} type="checkbox" checked={installed.length > 0 && selected.length === installed.length} onChange={() => setSelected(selected.length === installed.length ? [] : installed.map((item) => item.id))} /></span><span>名称</span><span>版本</span><span>来源</span><span>状态</span><span /></div>{installed.map((addon) => <div key={addon.id} className="grid grid-cols-[36px_minmax(210px,1.8fr)_100px_140px_110px_40px] items-center px-4 py-4 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50"><span><input aria-label={`选择${addon.name}`} disabled={isUninstalling} type="checkbox" checked={selected.includes(addon.id)} onChange={() => toggle(addon.id)} /></span><span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15"><FileTextIcon size={21} /></span><span><strong className="block">{addon.name}</strong><small className="mt-0.5 block text-slate-500">{addon.description}</small></span></span><span>{addon.version}</span><span className="text-slate-500 dark:text-slate-400">{addon.source}</span><span><StatusPill tone="success"><span className="size-1.5 rounded-full bg-emerald-500" />{addon.health}</StatusPill></span><IconButton label={`${addon.name}更多操作`}><DotsThreeVerticalIcon size={18} /></IconButton></div>)}</div>{selected.length > 0 && <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"><span className="text-sm font-semibold">{isUninstalling ? "正在卸载所选插件…" : `已选择 ${selected.length} 项`}</span><button type="button" disabled={isUninstalling} onClick={onUninstall} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-rose-950/30"><TrashIcon size={18} />卸载</button></div>}</section>
    <section className="mt-9"><h3 className="mb-3 text-lg font-bold">可安装</h3><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">{available.length ? available.map((addon) => { const isInstalling = installingAddonId === addon.id; return <div key={addon.id} className="flex items-center gap-4 px-5 py-5"><span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15"><CalendarDotsIcon size={24} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h4 className="font-bold">{addon.name}</h4><span className="text-xs text-slate-400">v{addon.version}</span></div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{addon.description}</p><p className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-300">{addon.source}</p></div><button type="button" disabled={Boolean(installingAddonId)} onClick={() => install(addon.id)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70">{isInstalling ? <ArrowClockwiseIcon size={18} className="animate-spin" /> : <DownloadSimpleIcon size={18} />}{isInstalling ? "正在安装…" : "安装"}</button></div>; }) : <p className="p-8 text-center text-sm text-slate-500">未找到匹配的插件。</p>}</div></section></>;
}

function SourcesPage({ sources, setSources, add, notify }: { sources: ControlSource[]; setSources: React.Dispatch<React.SetStateAction<ControlSource[]>>; add: () => void; notify: (tone: NonNullable<Notice>["tone"], text: string) => void }) {
  const test = (id: string) => { void testControlSource(id).then((report) => notify("success", `${report.message} 共发现 ${report.addonCount ?? 0} 个插件。`)).catch((error: unknown) => notify("error", error instanceof Error ? error.message : "控件源连接失败。")); };
  const toggle = (source: ControlSource) => { void setControlSourceEnabled(source.id, !source.enabled).then(setSources).catch(() => { setSources((items) => items.map((item) => item.id === source.id ? { ...item, enabled: !item.enabled } : item)); notify("warning", "控件源状态仅在当前界面更新，稍后请重试保存。"); }); };
  return <><header className="flex items-start justify-between gap-6"><div><p className="text-xs font-bold tracking-[0.12em] text-brand-600">插件分发</p><h2 className="mt-1 text-3xl font-bold tracking-tight">控件源</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">控件源提供插件列表与下载地址。只添加你信任的 HTTPS 地址。</p></div><button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"><PlusIcon size={18} />添加控件源</button></header><div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">{sources.map((source) => <article key={source.id} className="flex items-center gap-4 border-b border-slate-100 p-5 last:border-0 dark:border-slate-800"><span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LinkIcon size={22} /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-bold">{source.name}</h3>{source.defaultSource && <StatusPill>默认源</StatusPill>}<StatusPill tone={source.enabled ? "success" : "neutral"}>{source.enabled ? "已启用" : "已停用"}</StatusPill></div><p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{source.indexUrl}</p><p className="mt-2 text-xs text-slate-400">最近同步：{source.lastSyncedAt ?? "尚未同步"}</p></div><button type="button" onClick={() => test(source.id)} className="rounded-lg px-3 py-2 text-sm font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-600/10">测试连接</button><button type="button" onClick={() => toggle(source)} className={`relative h-7 w-12 rounded-full transition ${source.enabled ? "bg-brand-600" : "bg-slate-200 dark:bg-slate-700"}`} aria-label={`${source.enabled ? "停用" : "启用"}${source.name}`}><span className={`absolute top-1 size-5 rounded-full bg-white transition ${source.enabled ? "left-6" : "left-1"}`} /></button>{!source.defaultSource && <IconButton label={`编辑${source.name}`}><PencilSimpleIcon size={18} /></IconButton>}</article>)}</div><p className="mt-4 flex gap-2 text-sm text-slate-500 dark:text-slate-400"><InfoIcon className="mt-0.5 shrink-0" size={18} />同名插件按控件源优先级处理；首版只从已启用的可信源下载，并在安装前校验 SHA-256。</p></>;
}

function PermissionsPage({ report, granted, onApply, onOpenSettings }: { report: PermissionReport | null; granted: boolean; onApply: () => void; onOpenSettings: () => void }) {
  const rows = [
    ["找到 WPS Office", report?.wpsFound ? "已连接" : "未找到", Boolean(report?.wpsFound)],
    ["读取 WPS 版本与安装位置", report?.wpsPathReadable ? "已允许" : "需要检查", Boolean(report?.wpsPathReadable)],
    ["读写 WPS 加载项目录", granted ? "已允许" : "需要授权", granted]
  ] as const;
  return <><header><p className="text-xs font-bold tracking-[0.12em] text-brand-600">系统访问</p><h2 className="mt-1 text-3xl font-bold tracking-tight">权限</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">安装器只在需要安装、修复或卸载插件时访问 WPS 加载项目录。拒绝后可以在这里重新申请，不会自动修改系统设置。</p></header><div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">{rows.map(([label, state, okay]) => <div key={label} className="flex items-center gap-4 border-b border-slate-100 px-5 py-5 last:border-0 dark:border-slate-800"><span className={`grid size-10 place-items-center rounded-full ${okay ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" : "bg-amber-50 text-amber-600 dark:bg-amber-950/40"}`}>{okay ? <CheckCircleIcon size={22} weight="fill" /> : <LockKeyIcon size={21} />}</span><div className="flex-1"><h3 className="font-bold">{label}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{okay ? "安装器可继续执行对应操作。" : "请在继续前完成授权。"}</p></div><StatusPill tone={okay ? "success" : "warning"}>{state}</StatusPill></div>)}</div>{!granted && <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/25"><div className="flex gap-3"><WarningCircleIcon className="mt-0.5 shrink-0 text-amber-600" size={22} weight="fill" /><div><h3 className="font-bold text-amber-900 dark:text-amber-200">权限尚未开启</h3><p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">{report?.guidance ?? "请按系统设置步骤完成授权，然后重新检测。"}</p><div className="mt-4 flex gap-3"><button type="button" onClick={onOpenSettings} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">打开系统设置</button><button type="button" onClick={onApply} className="rounded-xl px-3 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/30">重新检测</button></div></div></div></section>}</>;
}

function HelpPage() {
  const guides = [
    { title: "快速开始", body: "在“插件”页确认已检测到 WPS，然后从“可安装”中选择插件。安装器会下载、校验并部署插件，完成后请重启 WPS。" },
    { title: "安装、更新与修复插件", body: "安装仅接受已启用控件源提供的 HTTPS 插件包，并会核对文件大小和 SHA-256。出现“需要修复”时，请重新安装对应版本。" },
    { title: "查看和卸载插件", body: "“已安装”列表显示名称、版本、来源和健康状态。勾选一个或多个插件后选择“卸载”，只会删除所选插件和对应的 WPS 配置。" },
    { title: "添加自定义控件源", body: "在“控件源”页添加发布者提供的 HTTPS 索引地址。先测试连接，确认索引有效后再启用；同名插件按控件源优先级处理。" },
    { title: "macOS 权限恢复", body: "在权限页点击“重新检测”。若仍无法写入，请在“系统设置 → 隐私与安全性 → 完全磁盘访问权限”中允许 WPS 插件管理器，然后重新打开应用。" },
    { title: "Windows 权限恢复", body: "在权限页重新检测，并确认系统“文件系统”访问未限制本应用。若开启了“受控文件夹访问”，请把 WPS 插件管理器加入允许列表。" },
    { title: "常见错误与诊断", body: "控件源无法连接时，请确认 URL 为 HTTPS 且网络可访问。下载或校验失败时，请联系发布者核对版本、文件大小和 SHA-256。" },
    { title: "发布控件包（维护者）", body: "索引应使用 schemaVersion: 1，且每个插件必须提供安全的 ID、版本、HTTPS 下载地址、文件大小和 64 位 SHA-256。不要使用会变动的 latest 下载地址。" }
  ];
  const [query, setQuery] = useState("");
  const [selectedGuide, setSelectedGuide] = useState<(typeof guides)[number] | null>(null);
  const visibleGuides = guides.filter((guide) => guide.title.includes(query.trim()));
  return <><header><p className="text-xs font-bold tracking-[0.12em] text-brand-600">离线帮助</p><h2 className="mt-1 text-3xl font-bold tracking-tight">帮助</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">按任务查找操作说明和故障恢复方法。</p></header><label className="relative mt-7 block max-w-xl"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户手册" className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-3 pl-10 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900" /></label><div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">{visibleGuides.length ? visibleGuides.map((guide) => <button type="button" key={guide.title} onClick={() => setSelectedGuide(guide)} className="flex w-full items-center gap-3 border-b border-slate-100 px-5 py-4 text-left text-sm font-semibold transition last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"><ClipboardTextIcon className="text-brand-600" size={20} />{guide.title}</button>) : <p className="px-5 py-4 text-sm text-slate-500">未找到匹配的帮助条目。</p>}</div>{selectedGuide && <article className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-600/30 dark:bg-brand-600/10"><div className="flex items-start justify-between gap-4"><div><h3 className="font-bold text-brand-900 dark:text-brand-100">{selectedGuide.title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700 dark:text-brand-100">{selectedGuide.body}</p></div><button type="button" onClick={() => setSelectedGuide(null)} className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-600/20">关闭</button></div></article>}</>;
}
