import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Solo los dos estados operativos que se persisten en BD.
const ESTADOS_OPCIONES = [
  { value: "EN_TRANSITO", label: "En tránsito" },
  { value: "RECIBIDA",    label: "Recibido" },
];

// Presets de ancho del modal
const MODAL_SIZES = {
  compact: { maxW: "max-w-xl",  label: "Compacto" },
  normal:  { maxW: "max-w-2xl", label: "Normal" },
  wide:    { maxW: "max-w-4xl", label: "Amplio" },
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
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ReadOnlyRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-800">{value || "-"}</span>
    </div>
  );
}

export default function GuiaEditModal({
  open,
  guia,
  loading = false,
  error = "",
  onClose,
  onSubmit,
}) {
  const [estado, setEstado]               = useState(guia?.estado ?? "EN_TRANSITO");
  const [fechaRecepcion, setFechaRecepcion] = useState(formatDate(guia?.fechaRecepcion));
  const [observaciones, setObservaciones]  = useState(guia?.observaciones ?? "");
  const [modalSize, setModalSize]          = useState(getInitialModalSize);

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

  let servicioActual = "Sin vincular";
  if (guia?.servicio) {
    servicioActual =
      guia.servicio.origen || guia.servicio.destino
        ? `${guia.servicio.origen ?? "-"} → ${guia.servicio.destino ?? "-"}`
        : guia.servicio.id;
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !loading) onClose?.();
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.({
      estado,
      fechaRecepcion: fechaRecepcion || null,
      observaciones: observaciones.trim() ? observaciones.trim() : null,
    });
  }

  const { maxW } = MODAL_SIZES[modalSize] ?? MODAL_SIZES.normal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div className={cn("w-full rounded-2xl border border-slate-200 bg-white shadow-2xl", maxW)}>
        {/* Cabecera */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Editar guía</h2>
            <p className="mt-1 text-sm text-slate-600">
              Solo puedes actualizar datos internos u operativos. La información oficial importada
              desde SUNAT se mantiene en solo lectura.
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

        <form className="space-y-5 px-6 py-5" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <ReadOnlyRow label="Guía" value={`${guia.serie}-${guia.numero}`} />
            <ReadOnlyRow label="Fecha de emisión" value={formatDisplayDate(guia.fechaEmision)} />
            <ReadOnlyRow label="Servicio vinculado" value={servicioActual} />
            <ReadOnlyRow label="Vehículo" value={guia.placaPrincipal ?? "-"} />
            <ReadOnlyRow label="Remitente" value={guia.remitenteNombre ?? "-"} />
            <ReadOnlyRow label="Destinatario" value={guia.destinatarioNombre ?? "-"} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Estado</span>
              <select
                value={estado}
                onChange={(event) => setEstado(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              >
                {ESTADOS_OPCIONES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Fecha de recepción</span>
              <input
                type="date"
                value={fechaRecepcion}
                onChange={(event) => setFechaRecepcion(event.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Observaciones internas</span>
            <textarea
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              rows={4}
              maxLength={2000}
              disabled={loading}
              placeholder="Agrega una observación interna..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
            />
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
