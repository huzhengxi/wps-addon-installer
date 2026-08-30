import { MagnifyingGlassIcon } from "@phosphor-icons/react";

export function SearchInput({ value, onChange, placeholder, labelClassName = "", inputClassName = "" }: { value: string; onChange: (value: string) => void; placeholder: string; labelClassName?: string; inputClassName?: string }) {
  const labelClasses = ["relative", "block", labelClassName].filter(Boolean).join(" ");
  const inputClasses = ["w-full", "rounded-xl", "border", "border-slate-200", "bg-white", "pr-3", "pl-10", "text-sm", "outline-none", "focus:border-brand-400", "dark:border-slate-700", "dark:bg-slate-900", inputClassName].filter(Boolean).join(" ");
  return <label className={labelClasses}>
    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClasses} />
  </label>;
}
