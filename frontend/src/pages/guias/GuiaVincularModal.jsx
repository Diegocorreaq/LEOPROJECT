import { useEffect, useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ServicioSuggestionList from "./ServicioSuggestionList";

// Presets de ancho del modal — comparte preferencia con GuiaEditModal
const MODAL_SIZES = {
  compact: { maxW: "max-w-2xl", label: "Compacto" },
  normal:  { maxW: "max-w-4xl", label: "Normal" },
  wide:    { maxW: "max-w-6xl", label: "Amplio" },
};
const SIZE_KEYS = ["compact", "normal", "wide"];

function getInitialModalSize() {
  try {
    const saved = localStorage.getItem("guia_modal_size");
    if (saved && MODAL_SIZES[saved]) return saved;
  } catch (_) {}
  return "normal";
}

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
  const [servicioSel, setServicioSel]       = useState(null);
  const [observaciones, setObservaciones]   = useState("");
  const [modalSize, setModalSize]           = useState(getInitialModalSize);

  function handleSizeChange(size) {
    setModalSize(size);
    try { localStorage.setItem("guia_modal_size", size); } catch (_) {}
  }

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

  const { maxW } = MODAL_SIZES[modalSize] ?? MODAL_SIZES.normal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={cn(
          "flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl",
          maxW,
        )}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Vincular a servicio</h2>
            <p className="mt-1 text-sm text-slate-600">
              Selecciona un servicio para la guía. Los datos importados se conservarán intactos.
            </p>
          </div>

          {/* Control de tamaño */}
          <div className="ml-4 flex shrink-0 items-center rounded border border-slate-200">
            {SIZE_KEYS.map((sz) => (
              <button
                key={sz}
                onClick={() => handleSizeChange(sz)}
                title={MODAL_SIZES[sz].label}
                className={cn(
                  "px-2 py-1 text-xs font-medium transition-colors",
                  modalSize === sz
                    ? "bg-slate-900 text-white"
                    : "text-slate-400 hover:bg-slate-100",
                )}
              >
                {MODAL_SIZES[sz].label}
              </button>
            ))}
          </div>
        </div>

        <form className="flex min-h-0 flex-1 flex-col px-6 py-5" onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Resumen de la guía */}
          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryRow label="Guía" value={`${guia.serie}-${guia.numero}`} />
            <SummaryRow label="Fecha" value={formatDate(guia.fechaEmision)} />
            <SummaryRow
              label="Ruta"
              value={
                [guia.puntoDeSalida, guia.puntoDeLlegada].filter(Boolean).join(" → ") || "-"
              }
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
                placeholder="Opcional: agrega una observación para esta vinculación..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
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
