import { cn } from "@/lib/utils";
import { LIQUIDACION_STATUS_CFG } from "./liquidacion-helpers";

export default function LiquidacionStatusBadge({ status, className }) {
  const config = LIQUIDACION_STATUS_CFG[status] ?? {
    label: status,
    cls: "border border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.cls,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
