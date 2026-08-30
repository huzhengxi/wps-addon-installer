import { DatabaseIcon, PuzzlePieceIcon, QuestionIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import type { ControlSource } from "./api";
import type { Addon, Page } from "./types";

export const APP_VERSION = __APP_VERSION__;

export const initialAddons: Addon[] = [];

export const initialSources: ControlSource[] = [
  { id: "official", name: "官方控件源", indexUrl: "https://huzhengxi.github.io/wps-addon-catalog/v1/index.json", enabled: true, defaultSource: true, lastSyncedAt: null },
  { id: "gitee", name: "Gitee 镜像", indexUrl: "https://gitee.com/example/wps-addon-catalog/releases", enabled: false, defaultSource: false, lastSyncedAt: null }
];

export const navItems: ReadonlyArray<{ id: Page; label: string; icon: typeof PuzzlePieceIcon }> = [
  { id: "addons", label: "插件", icon: PuzzlePieceIcon },
  { id: "sources", label: "控件源", icon: DatabaseIcon },
  { id: "permissions", label: "权限", icon: ShieldCheckIcon },
  { id: "help", label: "帮助", icon: QuestionIcon }
];
