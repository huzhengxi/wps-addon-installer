export type Page = "addons" | "sources" | "permissions" | "help" | "help-document";

export type ModalKind = "source" | "uninstall" | "update" | null;

export type WpsConnectionState = "checking" | "connected" | "not-found" | "unsupported" | "error";

export type Addon = {
  id: string;
  name: string;
  description: string;
  version: string;
  source: string;
  installed: boolean;
  health: "运行正常" | "需要修复" | "外部安装";
  sourceId?: string;
};
