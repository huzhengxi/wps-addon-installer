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

export const inspectEnvironment = () => invoke<EnvironmentReport>("inspect_environment");
export const installAddon = () => invoke<OperationReport>("install_addon");
export const uninstallAddon = () => invoke<OperationReport>("uninstall_addon");
export const listenToOperationProgress = (handler: (progress: OperationProgress) => void): Promise<UnlistenFn> =>
  listen<OperationProgress>("operation-progress", (event) => handler(event.payload));
