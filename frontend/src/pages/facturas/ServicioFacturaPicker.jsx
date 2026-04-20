import { useEffect, useState } from "react";
import { Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/dateOnly";

export default function ServicioFacturaPicker({ facturaId, onSelect, selectedId }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [loadingSug, setLoadingSug]   = useState(false);
  const [busqueda, setBusqueda]       = useState("");
  const [resultados, setResultados]   = useState(null);
  const [loadingBus, setLoadingBus]   = useState(false);
  const [errorBus, setErrorBus]       = useState("");

  useEffect(() => {
    if (!facturaId) return;
    setLoadingSug(true);
    api
      .get(`/facturas/${facturaId}/sugerencias-servicio`)
      .then(setSugerencias)
      .catch(() => setSugerencias([]))
      .finally(() => setLoadingSug(false));
  }, [facturaId]);

  async function handleBuscar(e) {
    e.preventDefault();
    if (!busqueda.trim()) return;
    setLoadingBus(true);
    setErrorBus("");
    try {
      const data = await api.get(`/facturas/servicios-disponibles?texto=${encodeURIComponent(busqueda.trim())}`);
      setResultados(data);
    } catch (err) {
      setErrorBus(err.message ?? "Error al buscar servicios.");
    } finally {
      setLoadingBus(false);
    }
  }

  const lista = resultados ?? sugerencias;
  const showingSugerencias = resultados == null;

  return (
    <div className="space-y-4">
      {/* Búsqueda manual */}
      <form onSubmit={handleBuscar} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); if (!e.target.value.trim()) setResultados(null); }}
            placeholder="Buscar por origen, destino, placa, cliente..."
            className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <button
          type="submit"
          disabled={loadingBus || !busqueda.trim()}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loadingBus ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </button>
        {resultados != null && (
          <button
            type="button"
            onClick={() => { setResultados(null); setBusqueda(""); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            Ver sugerencias
          </button>
        )}
      </form>

      {errorBus && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorBus}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {showingSugerencias ? "Sugerencias automáticas" : `Resultados de búsqueda (${lista.length})`}
        </p>

        {(loadingSug && showingSugerencias) ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : lista.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
            {showingSugerencias
              ? "No se encontraron sugerencias automáticas para esta factura."
              : "No se encontraron servicios con ese criterio."}
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {lista.map((s) => {
              const isSelected = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect?.(s)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium truncate", isSelected ? "text-white" : "text-slate-800")}>
                        {s.origen} → {s.destino}
                      </p>
                      <p className={cn("text-xs mt-0.5", isSelected ? "text-slate-300" : "text-slate-500")}>
                        {formatDateShort(s.fechaServicio)}
                        {s.vehiculo && ` · ${s.vehiculo.placa}`}
                        {s.conductor && ` · ${s.conductor.nombre}`}
                      </p>
                      {s.clientes?.length > 0 && (
                        <p className={cn("text-xs truncate", isSelected ? "text-slate-300" : "text-slate-400")}>
                          {s.clientes.map((c) => c.razonSocial).join(", ")}
                        </p>
                      )}
                      {s.razones?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.razones.map((r, i) => (
                            <span key={i} className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
