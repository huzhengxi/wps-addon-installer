import { WarningCircleIcon } from "@phosphor-icons/react";

export function PermissionGuidance({ guidance, onOpenSettings, onRecheck }: { guidance: string; onOpenSettings: () => void; onRecheck: () => void }) {
  return <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/25">
    <div className="flex gap-3">
      <WarningCircleIcon className="mt-0.5 shrink-0 text-amber-600" size={22} weight="fill" />
      <div>
        <h3 className="font-bold text-amber-900 dark:text-amber-200">权限尚未开启</h3>
        <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">{guidance}</p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onOpenSettings} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">打开系统设置</button>
          <button type="button" onClick={onRecheck} className="rounded-xl px-3 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/30">重新检测</button>
        </div>
      </div>
    </div>
  </section>;
}
