import { useEffect, useState } from "react";
import { Loader2, Search, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatDate,
  getClienteReferencia,
  getConductorNombre,
  getRutaLabel,
  getServicioReferencia,
} from "./liquidacion-helpers";
import { api } from "@/lib/api";

function ServiceSummaryCard({ servicio, selected = false }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Truck className={cn("h-3.5 w-3.5", selected ? "text-slate-300" : "text-slate-400")} />
            <span className="text-sm font-semibold">{servicio.vehiculo?.placa ?? "-"}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {getServicioReferencia(servicio)}
            </span>
          </div>
          <p className={cn("text-xs", selected ? "text-slate-300" : "text-slate-600")}>
            {getRutaLabel(servicio)}
          </p>
          <p className={cn("text-xs", selected ? "text-slate-400" : "text-slate-500")}>
            {formatDate(servicio.fechaServicio)} · {getConductorNombre(servicio.conductor)}
          </p>
          <p className={cn("text-xs", selected ? "text-slate-400" : "text-slate-500")}>
            {getClienteReferencia(servicio)}
          </p>
          {(servicio.razones ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {servicio.razones.map((razon) => (
                <span
                  key={razon}
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    selected ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {razon}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ServicioLiquidacionPicker({
  selectedService,
  onSelect,
  liquidacionId = "",
  disabled = false,
  locked = false,
}) {
  const [query, setQuery] = useState("");
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const searchParams = new URLSearchParams();

    if (query.trim()) {
      searchParams.set("texto", query.trim());
    }

    if (liquidacionId) {
      searchParams.set("liquidacionId", liquidacionId);
    }

    api
      .get(`/liquidaciones/servicios-disponibles${searchParams.toString() ? `?${searchParams.toString()}` : ""}`)
      .then((data) => {
        if (active) {
          setServices(data);
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "No se pudieron cargar servicios disponibles.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [query, liquidacionId]);

  return (
    <div className="space-y-4">
      {selectedService && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            {locked ? "Servicio vinculado desde el flujo actual" : "Servicio seleccionado"}
          </p>
          <ServiceSummaryCard servicio={selectedService} />
        </div>
      )}

      {!locked && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => {
                setLoading(true);
                setQuery(event.target.value);
              }}
              disabled={disabled}
              placeholder="Buscar por fecha, placa, conductor, ruta o cliente..."
              className="h-9 pl-8 text-sm"
            />
          </div>

          {loading ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No se encontraron servicios coincidentes. Puedes buscar manualmente.
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {services.map((servicio) => {
                const isSelected = selectedService?.id === servicio.id;
                return (
                  <button
                    key={servicio.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect?.(isSelected ? null : servicio)}
                    className="w-full text-left"
                  >
                    <ServiceSummaryCard servicio={servicio} selected={isSelected} />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
