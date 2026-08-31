import { useEffect, useState } from "react";
import { AddonsPage } from "./components/addons/AddonsPage";
import { InstallingAddonBanner } from "./components/addons/InstallingAddonBanner";
import { HelpDocumentPage } from "./components/help/HelpDocumentPage";
import { HelpPage } from "./components/help/HelpPage";
import { Sidebar } from "./components/layout/Sidebar";
import { AddSourceModal } from "./components/modals/AddSourceModal";
import { UninstallConfirmModal } from "./components/modals/UninstallConfirmModal";
import { UpdateModal } from "./components/modals/UpdateModal";
import { NoticeBanner } from "./components/common/NoticeBanner";
import { PermissionsPage } from "./components/permissions/PermissionsPage";
import { SourcesPage } from "./components/sources/SourcesPage";
import { useAddons } from "./hooks/useAddons";
import { useAppUpdate } from "./hooks/useAppUpdate";
import { useControlSources } from "./hooks/useControlSources";
import { useNotice } from "./hooks/useNotice";
import { usePermissions } from "./hooks/usePermissions";
import { helpGuides } from "./help-guides";
import type { ModalKind, Page, WpsConnectionState } from "./types";

export function App() {
  const [page, setPage] = useState<Page>("addons");
  const [modal, setModal] = useState<ModalKind>(null);
  const [query, setQuery] = useState("");
  const [helpGuideId, setHelpGuideId] = useState(helpGuides[0].id);
  const { notice, notify, clearNotice } = useNotice();
  const {
    installed,
    available,
    selected,
    setSelected,
    environment,
    environmentError,
    isUninstalling,
    isRefreshingAddons,
    installingAddonId,
    installingAddon,
    refreshAddons,
    install,
    uninstallSelected
  } = useAddons({ notify, clearNotice, query });
  const { sources, testingSourceIds, addSource, testSource, toggleSource } = useControlSources({ notify });
  const { permissionReport, permissionGranted, permissionNeedsAttention, recheckPermissions, openSettings } = usePermissions({ notify });
  const { update, isCheckingUpdate, isInstallingUpdate, checkForUpdate, installUpdate } = useAppUpdate({ notify });
  const wpsConnectionState: WpsConnectionState = environmentError
    ? "error"
    : !environment
      ? "checking"
      : !environment.wpsInstalled
        ? "not-found"
        : environment.wpsVersionSupported
          ? "connected"
          : "unsupported";

  useEffect(() => {
    if (update) setModal("update");
  }, [update]);

  return <main className="grid h-full grid-cols-[200px_minmax(0,1fr)] bg-[#f7f7fb] text-slate-900 dark:bg-[#10141d] dark:text-slate-100">
    <Sidebar page={page} onNavigate={setPage} permissionNeedsAttention={permissionNeedsAttention} wpsConnectionState={wpsConnectionState} isCheckingUpdate={isCheckingUpdate} onCheckUpdate={checkForUpdate} />

    <section className="min-w-0 overflow-auto px-8 py-7">
      <div className="mx-auto w-full max-w-[1080px]">
        {installingAddon && <InstallingAddonBanner addon={installingAddon} />}
        {notice && <NoticeBanner notice={notice} onDismiss={clearNotice} />}
        {page === "addons" && <AddonsPage
          installed={installed}
          available={available}
          query={query}
          selected={selected}
          environment={environment}
          environmentError={environmentError}
          isUninstalling={isUninstalling}
          isRefreshing={isRefreshingAddons}
          installingAddonId={installingAddonId}
          setQuery={setQuery}
          setSelected={setSelected}
          install={install}
          onRefresh={() => { void refreshAddons(); }}
          onOpenPermissions={() => setPage("permissions")}
          onUninstall={() => setModal("uninstall")}
        />}
        {page === "sources" && <SourcesPage sources={sources} testingSourceIds={testingSourceIds} onAdd={() => setModal("source")} onTest={testSource} onToggle={toggleSource} />}
        {page === "permissions" && <PermissionsPage report={permissionReport} granted={permissionGranted} onRecheck={recheckPermissions} onOpenSettings={openSettings} />}
        {page === "help" && <HelpPage onOpen={(guideId) => { setHelpGuideId(guideId); setPage("help-document"); }} />}
        {page === "help-document" && <HelpDocumentPage guideId={helpGuideId} onBack={() => setPage("help")} onNavigate={setHelpGuideId} />}
      </div>
    </section>

    {modal === "source" && <AddSourceModal onClose={() => setModal(null)} onConfirm={addSource} />}
    {modal === "uninstall" && <UninstallConfirmModal
      count={selected.length}
      isUninstalling={isUninstalling}
      onClose={() => setModal(null)}
      onConfirm={() => { void uninstallSelected().then((completed) => { if (completed) setModal(null); }); }}
    />}
    {modal === "update" && update && <UpdateModal update={update} isInstalling={isInstallingUpdate} onClose={() => setModal(null)} onConfirm={installUpdate} />}
  </main>;
}
