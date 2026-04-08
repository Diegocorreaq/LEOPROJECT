import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "./liquidacion-helpers";

function createEmptyComprobante() {
  return {
    tipo: "",
    numero: "",
    descripcion: "",
    monto: "",
    urlArchivo: "",
  };
}

export default function LiquidacionComprobantesEditor({ value = [], onChange, disabled = false }) {
  function updateItem(index, patch) {
    onChange?.(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange?.([...(value ?? []), createEmptyComprobante()]);
  }

  function removeItem(index) {
    onChange?.(value.filter((_, itemIndex) => itemIndex !== index));
  }

  const totalComprobantes = value.reduce((acc, item) => acc + Number(item.monto || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">Comprobantes</p>
          <p className="text-xs text-slate-500">
            {value.length} registrado(s) · Total {formatCurrency(totalComprobantes)}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={disabled}>
          <Plus className="h-4 w-4" />
          Agregar comprobante
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Aun no se agregaron comprobantes a esta liquidacion.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((comprobante, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Tipo</span>
                  <input
                    value={comprobante.tipo}
                    onChange={(event) => updateItem(index, { tipo: event.target.value })}
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                    placeholder="Factura, peaje..."
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Numero</span>
                  <input
                    value={comprobante.numero}
                    onChange={(event) => updateItem(index, { numero: event.target.value })}
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                    placeholder="Opcional"
                  />
                </label>

                <label className="space-y-1 xl:col-span-2">
                  <span className="text-xs font-medium text-slate-600">Descripcion</span>
                  <input
                    value={comprobante.descripcion}
                    onChange={(event) => updateItem(index, { descripcion: event.target.value })}
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                    placeholder="Detalle del comprobante"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Monto</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={comprobante.monto}
                    onChange={(event) => updateItem(index, { monto: event.target.value })}
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                    placeholder="0.00"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">URL archivo</span>
                  <input
                    value={comprobante.urlArchivo}
                    onChange={(event) => updateItem(index, { urlArchivo: event.target.value })}
                    disabled={disabled}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
                    placeholder="https://..."
                  />
                </label>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={disabled}
                    className="text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
