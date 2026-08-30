import type { CatalogAddon, InstalledAddon } from "../api";
import type { Addon } from "../types";
import { compareVersions } from "../version";

export const CATALOG_ADDON_DESCRIPTION = "来自控件源的 WPS 表格插件";
export const INSTALLED_ADDON_DESCRIPTION = "已部署到 WPS 加载项目录";

export function newestInstalledAddons(addons: Addon[]): Addon[] {
  const newestById = new Map<string, Addon>();
  for (const addon of addons) {
    if (!addon.installed) continue;
    const current = newestById.get(addon.id);
    if (!current || compareVersions(addon.version, current.version) > 0) newestById.set(addon.id, addon);
  }
  return [...newestById.values()];
}

export function mapCatalogAddons(addons: CatalogAddon[]): Addon[] {
  return addons.map((addon) => ({
    id: addon.id,
    name: addon.name,
    description: addon.description || CATALOG_ADDON_DESCRIPTION,
    version: addon.version,
    source: addon.sourceName,
    installed: false,
    health: "运行正常",
    sourceId: addon.sourceId
  }));
}

export function mapInstalledAddons(addons: InstalledAddon[]): Addon[] {
  return addons.map((addon) => ({
    ...addon,
    description: INSTALLED_ADDON_DESCRIPTION,
    installed: true,
    health: addon.health === "需要修复" ? "需要修复" : "运行正常"
  }));
}

export function filterAvailableAddons(addons: Addon[], installed: Addon[], query: string): Addon[] {
  const installedVersions = new Map(installed.map((addon) => [addon.id, addon.version]));
  return addons.filter((addon) => {
    if (addon.installed || !addon.name.includes(query.trim())) return false;
    const installedVersion = installedVersions.get(addon.id);
    return installedVersion === undefined || compareVersions(addon.version, installedVersion) > 0;
  });
}
