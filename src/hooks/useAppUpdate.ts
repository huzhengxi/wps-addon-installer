import { useEffect, useState } from "react";
import { checkAppUpdate, installAppUpdateAndRestart, type AppUpdateInfo } from "../api";
import type { Notify } from "./useNotice";

export function useAppUpdate({ notify }: { notify: Notify }) {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  useEffect(() => {
    void checkAppUpdate()
      .then((report) => {
        if (report.update) setUpdate(report.update);
      })
      .catch(() => undefined);
  }, []);

  const checkForUpdate = () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    void checkAppUpdate()
      .then((report) => {
        if (report.update) {
          setUpdate(report.update);
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

  return { update, isCheckingUpdate, isInstallingUpdate, checkForUpdate, installUpdate };
}
