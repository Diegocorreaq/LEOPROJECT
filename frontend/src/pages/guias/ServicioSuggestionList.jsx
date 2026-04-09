import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Search, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

function fechaCorta(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function matchesSearch(servicio, rawQuery) {
  if (!rawQuery.trim()) return true;

  const q = rawQuery.toLowerCase();
  const codigo = (servicio.codigo ?? "").toLowerCase();
  const id = (servicio.id ?? "").toLowerCase();
  const placa = (servicio.vehiculo?.placa ?? "").toLowerCase();
  const origen = (servicio.origen ?? "").toLowerCase();
  const destino = (servicio.destino ?? "").toLowerCase();
  const clientes = (servicio.clientes ?? [])
    .map((cliente) => (cliente.razonSocial ?? cliente.cliente?.razonSocial ?? "").toLowerCase())
    .join(" ");

  return (
    codigo.includes(q) ||
    id.includes(q) ||
    placa.includes(q) ||
    origen.includes(q) ||
    destino.includes(q) ||
    clientes.includes(q)
  );
}

function normalizeManualService(servicio) {
  return {
    id: servicio.id,
    codigo: servicio.codigo ?? null,
    fechaServicio: servicio.fechaServicio,
    origen: servicio.origen,
    destino: servicio.destino,
    vehiculo: servicio.vehiculo ? { placa: servicio.vehiculo.placa } : null,
    clientes: (servicio.clientes ?? []).map((item) => ({
      razonSocial: item.cliente?.razonSocial ?? "-",
    })),
    score: 0,
    razones: [],
  };
}

export default function ServicioSuggestionList({ guiaId, onSelect, selectedId }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(guiaId));
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!guiaId) return undefined;

    let active = true;

    Promise.all([api.get(`/guias/${guiaId}/sugerencias-servicio`), api.get("/servicios")])
      .then(([sugerenciasData, serviciosData]) => {
        if (!active) return;
        setSugerencias(Array.isArray(sugerenciasData) ? sugerenciasData : []);
        setServicios(Array.isArray(serviciosData) ? serviciosData : []);
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "No se pudieron cargar los servicios");
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
  }, [guiaId]);

  const filtrados = useMemo(() => {
    const sugeridos = sugerencias.filter((servicio) => matchesSearch(servicio, busqueda));
    if (!busqueda.trim()) return sugeridos;

    const existingIds = new Set(sugeridos.map((servicio) => servicio.id));
    const manuales = servicios
      .filter((servicio) => matchesSearch(servicio, busqueda))
      .filter((servicio) => !existingIds.has(servicio.id))
      .map(normalizeManualService);

    return [...sugeridos, ...manuales];
  }, [busqueda, servicios, sugerencias]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por servicio, cliente, ruta o placa..."
          className="h-8 pl-8 text-sm"
        />
      </div>

      {filtrados.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No se encontraron servicios coincidentes. Puedes buscar manualmente.
        </p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((servicio) => {
            const isSelected = selectedId === servicio.id;

            return (
              <button
                key={servicio.id}
                onClick={() => onSelect(isSelected ? null : servicio)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Truck
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isSelected ? "text-slate-300" : "text-slate-400",
                        )}
                      />
                      <span className={cn("text-sm font-medium", isSelected ? "text-white" : "text-slate-800")}>
                        {servicio.vehiculo?.placa ?? "-"}
                      </span>
                      <span className={cn("text-xs", isSelected ? "text-slate-300" : "text-slate-500")}>
                        {fechaCorta(servicio.fechaServicio)}
                      </span>
                      {servicio.codigo && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {servicio.codigo}
                        </span>
                      )}
                    </div>

                    <p className={cn("truncate text-xs", isSelected ? "text-slate-300" : "text-slate-600")}>
                      {servicio.origen} → {servicio.destino}
                    </p>

                    {servicio.clientes?.length > 0 && (
                      <p
                        className={cn(
                          "mt-0.5 truncate text-xs",
                          isSelected ? "text-slate-400" : "text-slate-400",
                        )}
                      >
                        {servicio.clientes.map((cliente) => cliente.razonSocial).join(", ")}
                      </p>
                    )}

                    {servicio.razones?.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {servicio.razones.map((razon, index) => (
                          <span
                            key={index}
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                              isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {razon}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <div className="shrink-0">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
