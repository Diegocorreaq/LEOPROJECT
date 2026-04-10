import { cn } from "@/lib/utils";

// Estados que se persisten en la BD. "Vinculado/No vinculado" son derivados.
export const ESTADO_CFG = {
  EN_TRANSITO: {
    label: "En tránsito",
    cls: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  RECIBIDA: {
    label: "Recibido",
    cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
};

export default function GuiaStatusBadge({ estado, className }) {
  const cfg = ESTADO_CFG[estado] ?? {
    label: estado ?? "Desconocido",
    cls: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        cfg.cls,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}

// Badge derivado de servicioId (no persistido en BD)
export function VinculoBadge({ vinculado, className }) {
  if (vinculado) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200",
          className,
        )}
      >
        Vinculado
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200",
        className,
      )}
    >
      Sin vincular
    </span>
  );
}
