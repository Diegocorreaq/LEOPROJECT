import { useMemo, useState } from "react";
import { Link, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import GuiaStatusBadge from "./GuiaStatusBadge";
import GuiaDetailDrawer from "./GuiaDetailDrawer";

function fechaCorta(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" });
}

const TABS = [
  { key: "TODOS", label: "Todos" },
  { key: "EMITIDA", label: "Emitida" },
  { key: "EN_TRANSITO", label: "En transito" },
  { key: "RECIBIDA", label: "Recibida" },
  { key: "CON_OBSERVACIONES", label: "Con obs." },
  { key: "SIN_VINCULAR", label: "Sin vincular" },
];

export default function GuiaListTab({ guias, loading, onGuiaUpdated, onGuiaDeleted }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("TODOS");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    return guias.filter((g) => {
      if (tab === "SIN_VINCULAR" && g.servicioId != null) return false;
      if (tab !== "TODOS" && tab !== "SIN_VINCULAR" && g.estado !== tab) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const numero = `${g.serie}-${g.numero}`.toLowerCase();
        const placa = (g.placaPrincipal ?? "").toLowerCase();
        const remitente = (g.remitenteNombre ?? "").toLowerCase();
        const destinatario = (g.destinatarioNombre ?? "").toLowerCase();

        if (
          !numero.includes(q) &&
          !placa.includes(q) &&
          !remitente.includes(q) &&
          !destinatario.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [guias, search, tab]);

  function handleGuiaUpdated(updatedGuia) {
    if (selected?.id === updatedGuia.id) {
      setSelected((prev) => ({ ...prev, ...updatedGuia }));
    }
    onGuiaUpdated?.(updatedGuia);
  }

  function handleGuiaDeleted(guiaId, message) {
    if (selected?.id === guiaId) {
      setSelected(null);
    }
    onGuiaDeleted?.(guiaId, message);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b px-8 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar numero, placa, remitente..."
            className="h-8 w-64 pl-8 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-0.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                tab === item.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
              <p className="text-sm">No hay guias para mostrar</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-slate-50">
                  {["Numero", "Fecha", "Servicio", "Vehiculo", "Estado", "Remitente", "Destinatario"].map(
                    (heading) => (
                      <th key={heading} className="px-4 py-2.5 text-xs font-semibold text-slate-500">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const isActive = selected?.id === g.id;

                  return (
                    <tr
                      key={g.id}
                      onClick={() => setSelected(isActive ? null : g)}
                      className={cn(
                        "cursor-pointer border-b transition-colors hover:bg-slate-50",
                        isActive && "bg-blue-50 hover:bg-blue-50",
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                        {g.serie}-{g.numero}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{fechaCorta(g.fechaEmision)}</td>
                      <td className="px-4 py-3 text-sm">
                        {g.servicioId ? (
                          <span className="text-slate-700">
                            {g.servicio?.origen
                              ? `${g.servicio.origen} -> ${g.servicio.destino}`
                              : g.servicioId.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <Link className="h-3 w-3" />
                            Sin vincular
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        <span>{g.placaPrincipal ?? "-"}</span>
                        {g.placaSecundaria && (
                          <span className="ml-1 text-xs text-slate-400">/ {g.placaSecundaria}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <GuiaStatusBadge estado={g.estado} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{g.remitenteNombre ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{g.destinatarioNombre ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="w-80 shrink-0 overflow-y-auto border-l bg-white shadow-sm">
            <GuiaDetailDrawer
              guia={selected}
              onClose={() => setSelected(null)}
              onUpdated={handleGuiaUpdated}
              onDeleted={handleGuiaDeleted}
            />
          </div>
        )}
      </div>
    </div>
  );
}
