import { useMemo, useState } from "react";
import { Link, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import FacturaStatusBadge from "./FacturaStatusBadge";
import FacturaDetailDrawer from "./FacturaDetailDrawer";

function fechaCorta(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtTotal(val, moneda) {
  if (val == null) return "-";
  const prefix = moneda === "USD" ? "$ " : "S/ ";
  return `${prefix}${Number(val).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const TABS = [
  { key: "TODOS",     label: "Todos" },
  { key: "PENDIENTE", label: "Pendiente" },
  { key: "PARCIAL",   label: "Parcial" },
  { key: "PAGADA",    label: "Pagada" },
  { key: "OBSERVADA", label: "Observada" },
  { key: "ANULADA",   label: "Anulada" },
  { key: "SIN_VINCULAR", label: "Sin vincular" },
];

export default function FacturaListTab({ facturas, loading, onFacturaUpdated, onFacturaDeleted }) {
  const [search, setSearch]   = useState("");
  const [tab, setTab]         = useState("TODOS");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    return facturas.filter((f) => {
      if (tab === "SIN_VINCULAR" && f.ordenServicioId != null) return false;
      if (tab !== "TODOS" && tab !== "SIN_VINCULAR" && f.estadoPago !== tab) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const num = `${f.serie}-${f.numero}`.toLowerCase();
        const razon = (f.cliente?.razonSocial ?? "").toLowerCase();
        const ruc = (f.cliente?.ruc ?? "").toLowerCase();
        if (!num.includes(q) && !razon.includes(q) && !ruc.includes(q)) return false;
      }

      return true;
    });
  }, [facturas, search, tab]);

  function handleUpdated(updated) {
    if (selected?.id === updated.id) setSelected((prev) => ({ ...prev, ...updated }));
    onFacturaUpdated?.(updated);
  }

  function handleDeleted(id, msg) {
    if (selected?.id === id) setSelected(null);
    onFacturaDeleted?.(id, msg);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b px-8 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Número, cliente, RUC..."
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
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
              <p className="text-sm">No hay facturas para mostrar</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-slate-50">
                  {["Número", "Fecha", "Cliente", "Total", "Servicio", "Estado", "Origen"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const isActive = selected?.id === f.id;
                  return (
                    <tr
                      key={f.id}
                      onClick={() => setSelected(isActive ? null : f)}
                      className={cn(
                        "cursor-pointer border-b transition-colors hover:bg-slate-50",
                        isActive && "bg-blue-50 hover:bg-blue-50"
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                        {f.serie}-{f.numero}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{fechaCorta(f.fechaEmision)}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-800">{f.cliente?.razonSocial ?? "-"}</p>
                        {f.cliente?.ruc && <p className="text-xs text-slate-400">{f.cliente.ruc}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {fmtTotal(f.total, f.moneda)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {f.ordenServicioId ? (
                          <span className="text-slate-700">
                            {f.ordenServicio?.servicio
                              ? `${f.ordenServicio.servicio.origen} → ${f.ordenServicio.servicio.destino}`
                              : f.ordenServicioId.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <Link className="h-3 w-3" />
                            Sin vincular
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <FacturaStatusBadge estado={f.estadoPago} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{f.origenImportacion ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="w-80 shrink-0 overflow-y-auto border-l bg-white shadow-sm">
            <FacturaDetailDrawer
              factura={selected}
              onClose={() => setSelected(null)}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          </div>
        )}
      </div>
    </div>
  );
}
