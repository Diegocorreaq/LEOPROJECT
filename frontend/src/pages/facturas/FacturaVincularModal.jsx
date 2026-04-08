import { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ServicioFacturaPicker from "./ServicioFacturaPicker";

export default function FacturaVincularModal({ open, factura, loading, error, onClose, onSubmit }) {
  const [servicioSel, setServicioSel] = useState(null);

  if (!open) return null;

  function handleSubmit() {
    if (!servicioSel) return;
    onSubmit?.({ servicioId: servicioSel.id });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Vincular a servicio</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Factura{" "}
              <span className="font-medium text-slate-700">
                {factura?.serie}-{factura?.numero}
              </span>
            </p>
          </div>
          <button onClick={onClose} disabled={loading} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ServicioFacturaPicker
            facturaId={factura?.id}
            onSelect={setServicioSel}
            selectedId={servicioSel?.id}
          />
        </div>

        {error && (
          <div className="mx-5 mb-3 flex shrink-0 items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex shrink-0 justify-end gap-3 border-t px-5 py-4">
          <button
            type="button" onClick={onClose} disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <Button onClick={handleSubmit} disabled={!servicioSel || loading}>
            {loading ? "Vinculando..." : "Vincular"}
          </Button>
        </div>
      </div>
    </div>
  );
}
