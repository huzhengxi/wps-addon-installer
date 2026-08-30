import { useEffect, useMemo, useRef, useState } from "react";
import {
  inspectEnvironment,
  installCatalogAddon,
  listCatalogAddons,
  listInstalledAddons,
  uninstallSelectedAddon,
  type EnvironmentReport
} from "../api";
import { initialAddons } from "../constants";
import {
  INSTALLED_ADDON_DESCRIPTION,
  filterAvailableAddons,
  mapCatalogAddons,
  mapInstalledAddons,
  newestInstalledAddons
} from "../lib/addons";
import type { Addon } from "../types";
import type { Notify } from "./useNotice";

export function useAddons({ notify, clearNotice, query }: { notify: Notify; clearNotice: () => void; query: string }) {
  const [addons, setAddons] = useState<Addon[]>(initialAddons);
  const [selected, setSelected] = useState<string[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentReport | null>(null);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [isRefreshingAddons, setIsRefreshingAddons] = useState(false);
  const [installingAddonId, setInstallingAddonId] = useState<string | null>(null);
  const refreshAddonsInFlight = useRef(false);

  const installed = useMemo(() => newestInstalledAddons(addons), [addons]);
  const available = useMemo(() => filterAvailableAddons(addons, installed, query), [addons, installed, query]);
  const installingAddon = addons.find((addon) => addon.id === installingAddonId && !addon.installed)
    ?? addons.find((addon) => addon.id === installingAddonId)
    ?? null;

  const refreshAddons = async (showResult = true) => {
    if (refreshAddonsInFlight.current) return;
    refreshAddonsInFlight.current = true;
    setIsRefreshingAddons(true);
    if (showResult) clearNotice();
    try {
      const [catalogResult, installedResult, environmentResult] = await Promise.allSettled([
        listCatalogAddons(),
        listInstalledAddons(),
        inspectEnvironment()
      ]);
      const catalogItems = catalogResult.status === "fulfilled" ? mapCatalogAddons(catalogResult.value.addons) : null;
      const installedItems = installedResult.status === "fulfilled" ? mapInstalledAddons(installedResult.value) : null;

      setAddons((items) => [
        ...(installedItems ?? items.filter((item) => item.installed)),
        ...(catalogItems ?? items.filter((item) => !item.installed))
      ]);

      if (environmentResult.status === "fulfilled") {
        setEnvironment(environmentResult.value);
        setEnvironmentError(null);
      } else {
        setEnvironment(null);
        setEnvironmentError(environmentResult.reason instanceof Error
          ? environmentResult.reason.message
          : typeof environmentResult.reason === "string"
            ? environmentResult.reason
            : "环境检查被拒绝或无法访问 WPS 环境。");
      }

      const catalogWarning = catalogResult.status === "fulfilled" ? catalogResult.value.warnings[0] : null;
      if (!showResult) {
        if (catalogWarning) notify("warning", catalogWarning);
        return;
      }

      if (catalogItems && installedItems) {
        const newestInstalled = newestInstalledAddons(installedItems);
        const availableCount = filterAvailableAddons(catalogItems, newestInstalled, "").length;
        const summary = `刷新完成：已安装 ${newestInstalled.length} 个，可安装或更新 ${availableCount} 个。`;
        if (catalogWarning) {
          notify("warning", `${summary} ${catalogWarning}`);
        } else if (environmentResult.status === "rejected") {
          notify("warning", `${summary} WPS 环境检测失败，请前往“权限”页面检查。`);
        } else {
          notify("success", summary);
        }
      } else if (catalogItems || installedItems) {
        notify("warning", `部分刷新完成：${catalogItems ? "控件源已同步" : "控件源同步失败，已保留上次数据"}；${installedItems ? "本地插件已重新扫描" : "本地插件扫描失败，已保留上次数据"}。`);
      } else {
        notify("error", "刷新失败：无法同步控件源，也无法扫描本地插件。请检查网络和 WPS 目录权限后重试。");
      }
    } finally {
      refreshAddonsInFlight.current = false;
      setIsRefreshingAddons(false);
    }
  };

  const install = (id: string) => {
    if (installingAddonId) return;
    const addon = addons.find((item) => item.id === id && !item.installed);
    if (!addon) return;
    if (!addon.sourceId) {
      notify("warning", `“${addon.name}”不是来自可用控件源，无法在线安装。`);
      return;
    }
    setInstallingAddonId(id);
    void installCatalogAddon(addon.sourceId, addon.id)
      .then((report) => {
        setAddons((items) => [
          ...items.filter((item) => item.id !== id || !item.installed),
          {
            id: addon.id,
            name: addon.name,
            description: INSTALLED_ADDON_DESCRIPTION,
            version: addon.version,
            source: "已安装目录",
            installed: true,
            health: "运行正常"
          }
        ]);
        notify("success", report.message);
      })
      .catch((error: unknown) => notify("error", error instanceof Error ? error.message : "插件安装失败。"))
      .finally(() => setInstallingAddonId(null));
  };

  const uninstallSelected = async (): Promise<boolean> => {
    if (isUninstalling) return false;
    const selectedAddons = addons.filter((item) => selected.includes(item.id) && item.installed);
    if (selectedAddons.length === 0) {
      notify("warning", "请选择至少一个已安装插件。 ");
      return false;
    }
    setIsUninstalling(true);
    const removed = new Set<string>();
    let failure: { addon: Addon; error: unknown } | null = null;
    try {
      for (const addon of selectedAddons) {
        try {
          await uninstallSelectedAddon(addon.id, addon.version);
          removed.add(`${addon.id}@${addon.version}`);
        } catch (error: unknown) {
          failure = { addon, error };
          break;
        }
      }

      // Installed entries are local scan results and do not carry a sourceId.
      // Remove them after deletion instead of turning them into installable
      // entries; any matching catalog entry remains and can be installed.
      if (removed.size > 0) {
        setAddons((items) => items.filter((item) => !item.installed || !removed.has(`${item.id}@${item.version}`)));
        const incompleteIds = new Set(selectedAddons
          .filter((addon) => !removed.has(`${addon.id}@${addon.version}`))
          .map((addon) => addon.id));
        setSelected((items) => items.filter((id) => incompleteIds.has(id)));
      }

      if (failure) {
        const reason = failure.error instanceof Error
          ? failure.error.message
          : typeof failure.error === "string"
            ? failure.error
            : "插件卸载失败。";
        const progress = removed.size > 0 ? `已卸载 ${removed.size} 项；` : "";
        notify("error", `${progress}“${failure.addon.name}”卸载失败：${reason}`);
        return false;
      }

      setSelected([]);
      notify("success", `已卸载 ${selectedAddons.length} 个插件。`);
      return true;
    } finally {
      setIsUninstalling(false);
    }
  };

  useEffect(() => {
    void refreshAddons(false);
  }, []);

  return {
    addons,
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
  };
}
