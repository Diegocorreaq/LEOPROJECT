import { useEffect, useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ServicioSuggestionList from "./ServicioSuggestionList";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-800">{value || "-"}</span>
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
  const [servicioSel, setServicioSel] = useState(null);
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onClose, open]);

  if (!open || !guia) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !loading) {
      onClose?.();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!servicioSel?.id) return;

    onSubmit?.({
      servicioId: servicioSel.id,
      observaciones: observaciones.trim() ? observaciones.trim() : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Vincular a servicio</h2>
          <p className="mt-1 text-sm text-slate-600">
            Selecciona un nuevo servicio para la guia. Los datos importados se conservaran intactos.
          </p>
        </div>

        <form className="flex min-h-0 flex-1 flex-col px-6 py-5" onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryRow label="Guia" value={`${guia.serie}-${guia.numero}`} />
            <SummaryRow label="Fecha" value={formatDate(guia.fechaEmision)} />
            <SummaryRow
              label="Ruta"
              value={[guia.puntoDeSalida, guia.puntoDeLlegada].filter(Boolean).join(" → ") || "-"}
            />
            <SummaryRow label="Placa" value={guia.placaPrincipal ?? "-"} />
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
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
                placeholder="Opcional: agrega una observacion para esta nueva vinculacion..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !servicioSel?.id}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {loading ? "Vinculando..." : "Vincular guia"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
