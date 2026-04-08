import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import LiquidacionDetailDrawer from "./LiquidacionDetailDrawer";
import LiquidacionStatusBadge from "./LiquidacionStatusBadge";
import {
  formatCurrency,
  formatDate,
  getClienteReferencia,
  getConductorNombre,
  getRutaLabel,
  getSaldoFavorTag,
  getServicioReferencia,
} from "./liquidacion-helpers";

const STATUS_TABS = [
  { key: "TODOS", label: "Todos" },
  { key: "PENDIENTE", label: "Pendiente" },
  { key: "LIQUIDADA", label: "Liquidada" },
  { key: "OBSERVADA", label: "Observada" },
  { key: "CANCELADO", label: "Cancelado" },
];

function matchesMonth(liquidacion, monthValue) {
  if (!monthValue) return true;
  const [year, month] = monthValue.split("-").map(Number);
  const serviceDate = new Date(liquidacion.servicio?.fechaServicio ?? liquidacion.createdAt);
  return serviceDate.getUTCFullYear() === year && serviceDate.getUTCMonth() + 1 === month;
}

export default function LiquidacionListTab({
  liquidaciones,
  loading,
  selectedLiquidacionId,
  onSelectLiquidacion,
  onLiquidacionUpdated,
  onLiquidacionDeleted,
  onEditLiquidacion,
}) {
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("TODOS");
  const [monthFilter, setMonthFilter] = useState("");
  const [favorFilter, setFavorFilter] = useState("TODOS");

  const filtered = useMemo(() => {
    return liquidaciones.filter((liquidacion) => {
      if (statusTab !== "TODOS" && liquidacion.status !== statusTab) return false;
      if (!matchesMonth(liquidacion, monthFilter)) return false;

      if (favorFilter === "EMPRESA" && getSaldoFavorTag(liquidacion) !== "EMPRESA") return false;
      if (favorFilter === "CONDUCTOR" && getSaldoFavorTag(liquidacion) !== "CONDUCTOR") return false;
      if (favorFilter === "PENDIENTES" && !["PENDIENTE", "OBSERVADA"].includes(liquidacion.status)) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const reference = getServicioReferencia(liquidacion.servicio).toLowerCase();
        const conductor = getConductorNombre(liquidacion.conductor || liquidacion.servicio?.conductor).toLowerCase();
        const placa = (liquidacion.servicio?.vehiculo?.placa ?? "").toLowerCase();
        const cliente = getClienteReferencia(liquidacion.servicio).toLowerCase();
        const ruta = getRutaLabel(liquidacion.servicio).toLowerCase();

        if (
          !reference.includes(query) &&
          !conductor.includes(query) &&
          !placa.includes(query) &&
          !cliente.includes(query) &&
          !ruta.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [favorFilter, liquidaciones, monthFilter, search, statusTab]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-8 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar servicio, conductor, placa, cliente..."
              className="h-8 w-72 pl-8 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-0.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  statusTab === tab.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={favorFilter}
            onChange={(event) => setFavorFilter(event.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="TODOS">Todos los saldos</option>
            <option value="PENDIENTES">Solo pendientes</option>
            <option value="EMPRESA">Saldo a favor empresa</option>
            <option value="CONDUCTOR">Saldo a favor conductor</option>
          </select>

          <input
            type="month"
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-slate-500">
              No hay liquidaciones para mostrar con los filtros actuales.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="border-b bg-slate-50">
                  {[
                    "Servicio",
                    "Fecha",
                    "Conductor",
                    "Placa",
                    "Cliente / pagador",
                    "Ruta",
                    "Status",
                    "Monto entregado",
                    "Total gastos",
                    "Saldo",
                    "Detalle saldo",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-xs font-semibold text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((liquidacion) => {
                  const isActive = selectedLiquidacionId === liquidacion.id;

                  return (
                    <tr
                      key={liquidacion.id}
                      onClick={() => onSelectLiquidacion?.(isActive ? null : liquidacion.id)}
                      className={cn(
                        "cursor-pointer border-b transition-colors hover:bg-slate-50",
                        isActive && "bg-blue-50 hover:bg-blue-50",
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                        {getServicioReferencia(liquidacion.servicio)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDate(liquidacion.servicio?.fechaServicio)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {getConductorNombre(liquidacion.conductor || liquidacion.servicio?.conductor)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {liquidacion.servicio?.vehiculo?.placa ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {getClienteReferencia(liquidacion.servicio)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{getRutaLabel(liquidacion.servicio)}</td>
                      <td className="px-4 py-3">
                        <LiquidacionStatusBadge status={liquidacion.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatCurrency(liquidacion.montoEntregado)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatCurrency(liquidacion.totalGastos)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                        {formatCurrency(liquidacion.saldo)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {liquidacion.detalleSaldo || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selectedLiquidacionId && (
          <div className="w-96 shrink-0 overflow-y-auto border-l bg-white shadow-sm">
            <LiquidacionDetailDrawer
              key={selectedLiquidacionId}
              liquidacionId={selectedLiquidacionId}
              onClose={() => onSelectLiquidacion?.(null)}
              onUpdated={onLiquidacionUpdated}
              onDeleted={onLiquidacionDeleted}
              onEdit={onEditLiquidacion}
            />
          </div>
        )}
      </div>
    </div>
  );
}
