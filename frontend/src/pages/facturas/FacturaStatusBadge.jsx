import { cn } from "@/lib/utils";

const CONFIG = {
  PENDIENTE:  { label: "Pendiente",  cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  PARCIAL:    { label: "Parcial",    cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  PAGADA:     { label: "Pagada",     cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  ANULADA:    { label: "Anulada",    cls: "bg-red-50 text-red-600 ring-red-200" },
  OBSERVADA:  { label: "Observada",  cls: "bg-orange-50 text-orange-700 ring-orange-200" },
};

export default function FacturaStatusBadge({ estado }) {
  const cfg = CONFIG[estado] ?? { label: estado ?? "—", cls: "bg-slate-100 text-slate-500 ring-slate-200" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", cfg.cls)}>
      {cfg.label}
    </span>
  );
}
