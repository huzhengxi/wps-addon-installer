import { CheckCircleIcon, LockKeyIcon } from "@phosphor-icons/react";
import { StatusPill } from "../common/StatusPill";

export function PermissionRow({ label, state, okay }: { label: string; state: string; okay: boolean }) {
  return <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-5 last:border-0 dark:border-slate-800">
    <span className={`grid size-10 place-items-center rounded-full ${okay ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" : "bg-amber-50 text-amber-600 dark:bg-amber-950/40"}`}>{okay ? <CheckCircleIcon size={22} weight="fill" /> : <LockKeyIcon size={21} />}</span>
    <div className="flex-1"><h3 className="font-bold">{label}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{okay ? "安装器可继续执行对应操作。" : "请在继续前完成授权。"}</p></div>
    <StatusPill tone={okay ? "success" : "warning"}>{state}</StatusPill>
  </div>;
}
