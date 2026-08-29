import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type InstallationStatus =
  | "not_installed"
  | "installed"
  | "partial"
  | "payload_invalid"
  | "unsupported";

export interface EnvironmentReport {
  architecture: string;
  addonVersion: string;
  installStatus: InstallationStatus;
  wpsInstalled: boolean;
  wpsRunning: boolean;
  wpsVersion: string | null;
  wpsVersionSupported: boolean;
  wpsMinimumVersion: string;
  jsAddonsPath: string;
  payloadValid: boolean;
  addonDirectoryExists: boolean;
  publishEntryMatches: boolean;
  message: string;
}

export interface OperationReport {
  action: "install" | "uninstall" | "restart";
  message: string;
  restartAttempted: boolean;
  restartSucceeded: boolean;
  warnings: string[];
}

export interface OperationProgress {
  action: "install" | "uninstall";
  percent: number;
  message: string;
}

export interface AppUpdateInfo {
  version: string;
  notes?: string;
  pubDate?: string;
}

export interface AppUpdateReport {
  currentVersion: string;
  update: AppUpdateInfo | null;
}

export interface AppUpdateProgress {
  downloaded: number;
  total?: number;
  percent?: number;
  message: string;
}

export interface ControlSource {
  id: string;
  name: string;
  indexUrl: string;
  enabled: boolean;
  defaultSource: boolean;
  lastSyncedAt: string | null;
}

export interface SourceTestReport {
  reachable: boolean;
  addonCount: number | null;
  message: string;
}

export interface CatalogAddon {
  id: string;
  name: string;
  type: "et";
  version: string;
  description: string;
  platforms: string[];
  downloadUrl: string;
  sha256: string;
  size: number;
  publishedAt: string | null;
  releaseNotes: string | null;
  sourceId: string;
  sourceName: string;
}

export interface CatalogReport {
  addons: CatalogAddon[];
  warnings: string[];
}

export interface InstalledAddon {
  id: string;
  name: string;
  version: string;
  source: string;
  health: "运行正常" | "需要修复";
}

export interface PermissionReport {
  wpsFound: boolean;
  wpsPathReadable: boolean;
  jsaddonsWritable: boolean;
  jsaddonsPath: string;
  guidance: string;
}

export const inspectEnvironment = () => invoke<EnvironmentReport>("inspect_environment");
export const installAddon = () => invoke<OperationReport>("install_addon");
export const uninstallAddon = () => invoke<OperationReport>("uninstall_addon");
export const listenToOperationProgress = (handler: (progress: OperationProgress) => void): Promise<UnlistenFn> =>
  listen<OperationProgress>("operation-progress", (event) => handler(event.payload));
export const checkAppUpdate = () => invoke<AppUpdateReport>("check_app_update");
export const installAppUpdateAndRestart = () => invoke<boolean>("install_app_update_and_restart");
export const listenToAppUpdateProgress = (handler: (progress: AppUpdateProgress) => void): Promise<UnlistenFn> =>
  listen<AppUpdateProgress>("app-update-progress", (event) => handler(event.payload));
export const listControlSources = () => invoke<ControlSource[]>("list_control_sources");
export const addControlSource = (input: Pick<ControlSource, "name" | "indexUrl">) =>
  invoke<ControlSource>("add_control_source", { input: { name: input.name, indexUrl: input.indexUrl } });
export const setControlSourceEnabled = (id: string, enabled: boolean) =>
  invoke<ControlSource[]>("set_control_source_enabled", { id, enabled });
export const testControlSource = (id: string) => invoke<SourceTestReport>("test_control_source", { id });
export const listCatalogAddons = () => invoke<CatalogReport>("list_catalog_addons");
export const installCatalogAddon = (sourceId: string, addonId: string) =>
  invoke<OperationReport>("install_catalog_addon", { sourceId, addonId });
export const listInstalledAddons = () => invoke<InstalledAddon[]>("list_installed_addons");
export const uninstallSelectedAddon = (addonId: string, version: string) =>
  invoke<OperationReport>("uninstall_selected_addon", { addonId, version });
export const inspectPermissions = () => invoke<PermissionReport>("inspect_permissions");
export const openPermissionSettings = () => invoke<void>("open_permission_settings");
