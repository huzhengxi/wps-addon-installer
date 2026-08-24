import { invoke } from "@tauri-apps/api/core";

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

export const inspectEnvironment = () => invoke<EnvironmentReport>("inspect_environment");
export const installAddon = () => invoke<OperationReport>("install_addon");
export const uninstallAddon = () => invoke<OperationReport>("uninstall_addon");
