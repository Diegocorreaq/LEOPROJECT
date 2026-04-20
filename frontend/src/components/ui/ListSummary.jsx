import { cn } from "@/lib/utils";

/**
 * ListSummary — resumen de registros visible sobre o debajo de tablas/listas.
 *
 * Props:
 *   total       {number}  registros actualmente visibles (después de filtros)
 *   grandTotal  {number?} total sin filtros (client-side); omitir si no está disponible
 *   page        {number?} página actual (1-based), requerido para vistas paginadas
 *   pageSize    {number?} registros por página, requerido para vistas paginadas
 *   className   {string?}
 *   noun        {string?} nombre en singular del elemento, ej: "guía" (default "registro")
 *   nounPlural  {string?} nombre en plural, ej: "guías" (default noun+"s")
 *
 * Ejemplos de output:
 *   Sin filtros, sin paginación:          "24 servicios"
 *   Con filtros, sin paginación:          "8 de 24 servicios"
 *   Sin filtros, paginado:                "Mostrando 1–50 de 248 guías"
 *   Con filtros, paginado:                "Mostrando 1–50 de 37 guías filtradas (248 totales)"
 *   Sin resultados:                       null (deja que el empty-state de la tabla lo maneje)
 */
export default function ListSummary({
  total = 0,
  grandTotal,
  page,
  pageSize,
  className = "",
  noun = "registro",
  nounPlural,
}) {
  const plural = nounPlural ?? `${noun}s`;

  if (!total) return null;

  const word     = total === 1 ? noun : plural;
  const paginated = page != null && pageSize != null;
  const filtered  = grandTotal != null && total !== grandTotal;

  // ── Paginado ──────────────────────────────────────────────────────────────
  if (paginated) {
    const from = (page - 1) * pageSize + 1;
    const to   = Math.min(page * pageSize, total);

    if (filtered) {
      return (
        <span className={cn("text-xs text-slate-500", className)}>
          Mostrando{" "}
          <span className="font-medium text-slate-700">{from}–{to}</span>
          {" "}de{" "}
          <span className="font-medium text-slate-700">{total.toLocaleString("es-PE")}</span>
          {" "}{word} filtrados
          <span className="text-slate-400"> ({grandTotal.toLocaleString("es-PE")} totales)</span>
        </span>
      );
    }

    return (
      <span className={cn("text-xs text-slate-500", className)}>
        Mostrando{" "}
        <span className="font-medium text-slate-700">{from}–{to}</span>
        {" "}de{" "}
        <span className="font-medium text-slate-700">{total.toLocaleString("es-PE")}</span>
        {" "}{word}
      </span>
    );
  }

  // ── No paginado, con filtros ───────────────────────────────────────────────
  if (filtered) {
    return (
      <span className={cn("text-xs text-slate-500", className)}>
        <span className="font-medium text-slate-700">{total.toLocaleString("es-PE")}</span>
        {" "}de{" "}
        <span className="font-medium text-slate-700">{grandTotal.toLocaleString("es-PE")}</span>
        {" "}{plural}
      </span>
    );
  }

  // ── No paginado, sin filtros ───────────────────────────────────────────────
  return (
    <span className={cn("text-xs text-slate-500", className)}>
      <span className="font-medium text-slate-700">{total.toLocaleString("es-PE")}</span>
      {" "}{word}
    </span>
  );
}
