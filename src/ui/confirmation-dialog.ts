export type ConfirmationAction = "install" | "uninstall" | "app-update";

export interface ConfirmationDialogView {
  confirm(action: ConfirmationAction): Promise<boolean>;
}

export function createConfirmationDialogView(options: {
  dialog: HTMLElement;
  title: HTMLElement;
  message: HTMLElement;
  cancel: HTMLButtonElement;
  confirm: HTMLButtonElement;
}): ConfirmationDialogView {
  const { dialog, title, message, cancel, confirm } = options;
  let resolver: ((confirmed: boolean) => void) | undefined;

  function close(confirmed: boolean) {
    dialog.hidden = true;
    resolver?.(confirmed);
    resolver = undefined;
  }

  cancel.addEventListener("click", () => close(false));
  confirm.addEventListener("click", () => close(true));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) close(false);
  });

  return {
    confirm(action) {
      title.textContent = action === "install" ? "安装日期选择器？" : action === "uninstall" ? "卸载日期选择器？" : "更新安装器？";
      message.textContent = action === "install"
        ? "安装或修复会关闭并重新打开 WPS。请先保存所有正在编辑的 WPS 文档。"
        : action === "uninstall"
          ? "卸载会关闭并重新打开 WPS。请先保存所有正在编辑的 WPS 文档。"
          : "即将下载并安装新版安装器，安装完成后会重启本应用；已部署的 WPS 加载项不会被自动修改。";
      dialog.hidden = false;
      confirm.textContent = action === "install" ? "开始安装" : action === "uninstall" ? "确认卸载" : "开始更新";
      confirm.focus();
      return new Promise<boolean>((resolve) => {
        resolver = resolve;
      });
    }
  };
}
