import { useEffect, useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtGuiaDate } from "@/lib/dateGuia";
import ServicioSuggestionList from "./ServicioSuggestionList";

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <p className="mt-1 text-sm font-medium text-slate-800 truncate">{value || "-"}</p>
    </div>
  );
}

function SummaryCardWide({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <p className="mt-1 text-sm leading-snug text-slate-800 break-words line-clamp-3">{value || "-"}</p>
    </div>
  );
}

export default function GuiaVincularModal({
  open,
  guia,
  loading = false,
  error = "",
  onClose,
  onSubmit,
}) {
  const [servicioSel, setServicioSel]     = useState(null);
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) onClose?.();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onClose, open]);

  if (!open || !guia) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !loading) onClose?.();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!servicioSel?.id) return;
    onSubmit?.({
      servicioId: servicioSel.id,
      observaciones: observaciones.trim() ? observaciones.trim() : undefined,
    });
  }

  const ruta = [guia.puntoDeSalida, guia.puntoDeLlegada].filter(Boolean).join(" → ") || "-";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-6 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

        {/* Cabecera */}
        <div className="border-b border-slate-100 px-8 py-6">
          <h2 className="text-lg font-semibold text-slate-900">Vincular a servicio</h2>
          <p className="mt-1 text-sm text-slate-500">
            Selecciona un servicio para la guía. Los datos importados se conservarán intactos.
          </p>
        </div>

        <form className="flex min-h-0 flex-1 flex-col px-8 py-6" onSubmit={handleSubmit}>
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Resumen de la guía — fila 1: Guía / Fecha / Placa */}
          <div className="mb-3 grid grid-cols-3 gap-3">
            <SummaryCard label="Guía"  value={`${guia.serie}-${guia.numero}`} />
            <SummaryCard label="Fecha" value={fmtGuiaDate(guia.fechaEmision)} />
            <SummaryCard label="Placa" value={guia.placaPrincipal ?? "-"} />
          </div>

          {/* Fila 2: Ruta — ancho completo, texto sin truncar */}
          <div className="mb-6">
            <SummaryCardWide label="Ruta" value={ruta} />
          </div>

          {/* Lista de servicios + observaciones */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Selecciona un servicio</p>
              <ServicioSuggestionList
                guiaId={guia.id}
                onSelect={setServicioSel}
                selectedId={servicioSel?.id}
              />
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Observaciones internas</span>
              <textarea
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                rows={3}
                maxLength={2000}
                disabled={loading}
                placeholder="Opcional: agrega una observación para esta vinculación..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              />
            </label>
          </div>

          {/* Botones */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !servicioSel?.id}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {loading ? "Vinculando..." : "Vincular guía"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
