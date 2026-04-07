import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ESTADO_CFG } from "./GuiaStatusBadge";

const ESTADOS_OPCIONES = Object.entries(ESTADO_CFG).map(([value, config]) => ({
  value,
  label: config.label,
}));

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
  const [estado, setEstado] = useState(guia?.estado ?? "EMITIDA");
  const [fechaRecepcion, setFechaRecepcion] = useState(formatDate(guia?.fechaRecepcion));
  const [observaciones, setObservaciones] = useState(guia?.observaciones ?? "");

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

  let servicioActual = "Sin vincular";
  if (guia?.servicio) {
    servicioActual =
      guia.servicio.origen || guia.servicio.destino
        ? `${guia.servicio.origen ?? "-"} -> ${guia.servicio.destino ?? "-"}`
        : guia.servicio.id;
  }

  if (!open || !guia) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !loading) {
      onClose?.();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.({
      estado,
      fechaRecepcion: fechaRecepcion || null,
      observaciones: observaciones.trim() ? observaciones.trim() : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Editar guia</h2>
          <p className="mt-1 text-sm text-slate-600">
            Solo puedes actualizar los datos internos u operativos. La informacion oficial importada
            desde SUNAT se mantiene en solo lectura.
          </p>
        </div>

        <form className="space-y-5 px-6 py-5" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <ReadOnlyRow label="Guia" value={`${guia.serie}-${guia.numero}`} />
            <ReadOnlyRow label="Fecha emision" value={formatDisplayDate(guia.fechaEmision)} />
            <ReadOnlyRow label="Servicio vinculado" value={servicioActual} />
            <ReadOnlyRow label="Vehiculo" value={guia.placaPrincipal ?? "-"} />
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
                {ESTADOS_OPCIONES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Fecha de recepcion</span>
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
              placeholder="Agrega una observacion interna..."
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
