import { cn } from "@/lib/utils";

const ESTADO_CFG = {
  EMITIDA:           { label: "Emitida",           cls: "bg-slate-100 text-slate-700 border border-slate-200" },
  EN_TRANSITO:       { label: "En tránsito",        cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  RECIBIDA:          { label: "Recibida",           cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  CON_OBSERVACIONES: { label: "Con observaciones",  cls: "bg-amber-50 text-amber-700 border border-amber-200" },
};

export default function GuiaStatusBadge({ estado, className }) {
  const cfg = ESTADO_CFG[estado] ?? { label: estado, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg.cls, className)}>
      {cfg.label}
    </span>
  );
}

export { ESTADO_CFG };
