import type { PermissionReport } from "../../api";
import { PageHeader } from "../common/PageHeader";
import { PermissionGuidance } from "./PermissionGuidance";
import { PermissionRow } from "./PermissionRow";

export function PermissionsPage({ report, granted, onRecheck, onOpenSettings }: { report: PermissionReport | null; granted: boolean; onRecheck: () => void; onOpenSettings: () => void }) {
  const rows = [
    ["找到 WPS Office", report?.wpsFound ? "已连接" : "未找到", Boolean(report?.wpsFound)],
    ["读取 WPS 版本与安装位置", report?.wpsPathReadable ? "已允许" : "需要检查", Boolean(report?.wpsPathReadable)],
    ["读写 WPS 加载项目录", granted ? "已允许" : "需要授权", granted]
  ] as const;
  return <>
    <PageHeader
      eyebrow="系统访问"
      title="权限"
      description="安装器只在需要安装、修复或卸载插件时访问 WPS 加载项目录。拒绝后可以在这里重新申请，不会自动修改系统设置。"
      descriptionClassName="mt-2 max-w-2xl text-[13px] leading-5 text-slate-500 dark:text-slate-400"
    />
    <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02] dark:border-slate-800 dark:bg-slate-900">
      {rows.map(([label, state, okay]) => <PermissionRow key={label} label={label} state={state} okay={okay} />)}
    </div>
    {!granted && <PermissionGuidance guidance={report?.guidance ?? "请按系统设置步骤完成授权，然后重新检测。"} onOpenSettings={onOpenSettings} onRecheck={onRecheck} />}
  </>;
}
