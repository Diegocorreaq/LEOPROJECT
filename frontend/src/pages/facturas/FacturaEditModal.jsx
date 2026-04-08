import { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ESTADOS_PAGO = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "PARCIAL",   label: "Parcial" },
  { value: "PAGADA",    label: "Pagada" },
  { value: "ANULADA",   label: "Anulada" },
  { value: "OBSERVADA", label: "Observada" },
];

export default function FacturaEditModal({ open, factura, loading, error, onClose, onSubmit }) {
  const [estadoPago, setEstadoPago]           = useState(factura?.estadoPago ?? "PENDIENTE");
  const [formaPago, setFormaPago]             = useState(factura?.formaPago ?? "");
  const [fechaVencimiento, setFechaVencimiento] = useState(
    factura?.fechaVencimiento ? factura.fechaVencimiento.slice(0, 10) : ""
  );
  const [detrPct, setDetrPct]   = useState(String(factura?.detraccionPorcentaje ?? ""));
  const [detrMonto, setDetrMonto] = useState(String(factura?.detraccionMonto ?? ""));

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { estadoPago };
    if (formaPago !== (factura?.formaPago ?? "")) payload.formaPago = formaPago || null;
    if (fechaVencimiento) payload.fechaVencimiento = fechaVencimiento;
    else if (fechaVencimiento === "" && factura?.fechaVencimiento) payload.fechaVencimiento = null;
    if (detrPct !== "") payload.detraccionPorcentaje = parseFloat(detrPct);
    if (detrMonto !== "") payload.detraccionMonto = parseFloat(detrMonto);
    onSubmit?.(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-slate-900">Editar factura</h2>
          <button onClick={onClose} disabled={loading} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Estado de pago</label>
            <select
              value={estadoPago}
              onChange={(e) => setEstadoPago(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {ESTADOS_PAGO.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Forma de pago</label>
            <input
              type="text"
              value={formaPago}
              onChange={(e) => setFormaPago(e.target.value)}
              placeholder="Contado, crédito 30 días..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Fecha de vencimiento</label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Detracción %</label>
              <input
                type="number" step="0.01" min="0" max="100"
                value={detrPct}
                onChange={(e) => setDetrPct(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Detracción S/.</label>
              <input
                type="number" step="0.01" min="0"
                value={detrMonto}
                onChange={(e) => setDetrMonto(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button" onClick={onClose} disabled={loading}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
