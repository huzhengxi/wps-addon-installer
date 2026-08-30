import { ArrowClockwiseIcon } from "@phosphor-icons/react";

export function Spinner({ size = 18, spin = true, className = "" }: { size?: number; spin?: boolean; className?: string }) {
  const classes = [spin ? "animate-spin" : "", className].filter(Boolean).join(" ");
  return <ArrowClockwiseIcon size={size} className={classes} />;
}
