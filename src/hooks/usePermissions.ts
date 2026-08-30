import { useEffect, useState } from "react";
import { inspectPermissions, openPermissionSettings, type PermissionReport } from "../api";
import type { Notify } from "./useNotice";

export function usePermissions({ notify }: { notify: Notify }) {
  const [permissionReport, setPermissionReport] = useState<PermissionReport | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    void inspectPermissions().then((report) => {
      setPermissionReport(report);
      setPermissionGranted(report.jsaddonsWritable);
    }).catch(() => undefined);
  }, []);

  const permissionNeedsAttention = permissionReport !== null && (!permissionReport.wpsFound || !permissionReport.wpsPathReadable || !permissionReport.jsaddonsWritable);

  const recheckPermissions = () => {
    void inspectPermissions().then((report) => {
      setPermissionReport(report);
      setPermissionGranted(report.jsaddonsWritable);
      notify(report.jsaddonsWritable ? "success" : "warning", report.guidance);
    }).catch(() => notify("warning", "当前系统未返回权限状态，请按下方步骤在系统设置中完成授权。"));
  };

  const openSettings = () => {
    void openPermissionSettings().then(() => notify("success", "系统权限设置已打开。完成授权后请返回此页重新检测。")).catch(() => notify("warning", "无法自动打开系统设置，请按下方步骤手动开启权限。"));
  };

  return { permissionReport, permissionGranted, permissionNeedsAttention, recheckPermissions, openSettings };
}
