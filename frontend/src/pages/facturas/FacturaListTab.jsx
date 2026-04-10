import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import FacturaStatusBadge from "./FacturaStatusBadge";
import FacturaDetailDrawer from "./FacturaDetailDrawer";
import {
  fechaCorta,
  fmtTotal,
  isFacturaVencida,
  isFacturaPorVencer,
  getFacturaPrimaryGuia,
  getFacturaServicioResumen,
} from "./facturaHelpers";

const STATUS_TABS = [
  { key: "TODOS",       label: "Todos" },
  { key: "PENDIENTE",   label: "Pendiente" },
  { key: "PARCIAL",     label: "Parcial" },
  { key: "PAGADA",      label: "Pagada" },
  { key: "OBSERVADA",   label: "Observada" },
  { key: "ANULADA",     label: "Anulada" },
  { key: "SIN_VINCULAR", label: "Sin vincular" },
];

// Micro-badge para alertas inline
function AlertTag({ label, color }) {
  const cls = {
    red:   "bg-red-50 text-red-600 ring-red-200",
    amber: "bg-amber-50 text-amber-600 ring-amber-200",
    blue:  "bg-blue-50 text-blue-600 ring-blue-200",
    slate: "bg-slate-100 text-slate-500 ring-slate-200",
  }[color] ?? "bg-slate-100 text-slate-500 ring-slate-200";
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
      cls
    )}>
      {label}
    </span>
  );
}

// Badge de forma de pago
function FormaPagoBadge({ formaPago }) {
  if (!formaPago) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset uppercase tracking-wide",
      formaPago === "CREDITO"
        ? "bg-blue-50 text-blue-700 ring-blue-200"
        : "bg-slate-100 text-slate-600 ring-slate-200"
    )}>
      {formaPago === "CREDITO" ? "Crédito" : "Contado"}
    </span>
  );
}

// Select compacto para filtros rápidos
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] font-medium text-slate-400 shrink-0">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 cursor-pointer rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function FacturaListTab({ facturas, loading, onFacturaUpdated, onFacturaDeleted }) {
  const [search, setSearch]                       = useState("");
  const [tab, setTab]                             = useState("TODOS");
  const [selected, setSelected]                   = useState(null);
  const [filterFormaPago, setFilterFormaPago]     = useState("");
  const [filterVencimiento, setFilterVencimiento] = useState("");
  const [filterDetraccion, setFilterDetraccion]   = useState("");
  const [filterVinculo, setFilterVinculo]         = useState("");
  const [filterGuias, setFilterGuias]             = useState("");

  const filtered = useMemo(() => {
    return facturas.filter((f) => {
      // Tabs de estado
      if (tab === "SIN_VINCULAR" && f.ordenServicioId != null) return false;
      if (tab !== "TODOS" && tab !== "SIN_VINCULAR" && f.estadoPago !== tab) return false;

      // Búsqueda extendida: número, cliente, RUC, guía, placa, origen, destino
      if (search.trim()) {
        const q = search.toLowerCase();
        const num       = `${f.serie}-${f.numero}`.toLowerCase();
        const razon     = (f.cliente?.razonSocial ?? "").toLowerCase();
        const ruc       = (f.cliente?.ruc ?? "").toLowerCase();
        const srv       = f.ordenServicio?.servicio;
        const placa     = (srv?.vehiculo?.placa ?? "").toLowerCase();
        const origen    = (srv?.origen ?? "").toLowerCase();
        const destino   = (srv?.destino ?? "").toLowerCase();
        const guiasText = (f.guias ?? [])
          .map((g) => `${g.serieGuia}-${g.numeroGuia}`)
          .join(" ")
          .toLowerCase();
        if (
          !num.includes(q) &&
          !razon.includes(q) &&
          !ruc.includes(q) &&
          !placa.includes(q) &&
          !origen.includes(q) &&
          !destino.includes(q) &&
          !guiasText.includes(q)
        ) return false;
      }

      // Filtro forma de pago
      if (filterFormaPago && f.formaPago !== filterFormaPago) return false;

      // Filtro vencimiento
      if (filterVencimiento === "VENCIDAS"       && !isFacturaVencida(f))   return false;
      if (filterVencimiento === "POR_VENCER"     && !isFacturaPorVencer(f)) return false;
      if (filterVencimiento === "SIN_VENCIMIENTO" && !!f.fechaVencimiento)  return false;

      // Filtro detracción
      const tieneDetraccion =
        Number(f.detraccionMonto) > 0 || Number(f.detraccionPorcentaje) > 0;
      if (filterDetraccion === "CON" && !tieneDetraccion) return false;
      if (filterDetraccion === "SIN" && tieneDetraccion)  return false;

      // Filtro vínculo
      if (filterVinculo === "VINCULADAS"  && !f.ordenServicioId)  return false;
      if (filterVinculo === "SIN_VINCULAR" && !!f.ordenServicioId) return false;

      // Filtro guías
      const cantGuias = f.guias?.length ?? 0;
      if (filterGuias === "CON" && cantGuias === 0) return false;
      if (filterGuias === "SIN" && cantGuias > 0)   return false;

      return true;
    });
  }, [facturas, search, tab, filterFormaPago, filterVencimiento, filterDetraccion, filterVinculo, filterGuias]);

  const activeFiltersCount = [
    filterFormaPago, filterVencimiento, filterDetraccion, filterVinculo, filterGuias,
  ].filter(Boolean).length;

  function clearFilters() {
    setFilterFormaPago("");
    setFilterVencimiento("");
    setFilterDetraccion("");
    setFilterVinculo("");
    setFilterGuias("");
  }

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

      {/* Barra de búsqueda + filtros rápidos */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-white px-4 py-2.5 sm:px-6">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nº factura, cliente, RUC, guía, placa, ruta..."
            className="h-8 w-full pl-8 text-sm sm:w-72"
          />
        </div>

        <div className="h-4 w-px bg-slate-200" />

        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect
            label="Pago"
            value={filterFormaPago}
            onChange={setFilterFormaPago}
            options={[
              { value: "",        label: "Todos" },
              { value: "CONTADO", label: "Contado" },
              { value: "CREDITO", label: "Crédito" },
            ]}
          />
          <FilterSelect
            label="Vencimiento"
            value={filterVencimiento}
            onChange={setFilterVencimiento}
            options={[
              { value: "",               label: "Todos" },
              { value: "VENCIDAS",       label: "Vencidas" },
              { value: "POR_VENCER",     label: "Por vencer" },
              { value: "SIN_VENCIMIENTO", label: "Sin vencimiento" },
            ]}
          />
          <FilterSelect
            label="Detracción"
            value={filterDetraccion}
            onChange={setFilterDetraccion}
            options={[
              { value: "",    label: "Todas" },
              { value: "CON", label: "Con detracción" },
              { value: "SIN", label: "Sin detracción" },
            ]}
          />
          <FilterSelect
            label="Vínculo"
            value={filterVinculo}
            onChange={setFilterVinculo}
            options={[
              { value: "",           label: "Todas" },
              { value: "VINCULADAS",  label: "Vinculadas" },
              { value: "SIN_VINCULAR", label: "Sin vincular" },
            ]}
          />
          <FilterSelect
            label="Guías"
            value={filterGuias}
            onChange={setFilterGuias}
            options={[
              { value: "",    label: "Todas" },
              { value: "CON", label: "Con guía" },
              { value: "SIN", label: "Sin guía" },
            ]}
          />
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-slate-400 underline hover:text-slate-600"
            >
              Limpiar ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* Tabs de estado */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-white px-4 py-1.5 sm:px-6">
        {STATUS_TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              tab === item.key
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            )}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">
          {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      {/* Tabla + drawer */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
              <p className="text-sm">No hay facturas para mostrar</p>
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-slate-500 underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ── Cards móvil (< md) ── */}
              <div className="divide-y md:hidden">
                {filtered.map((f) => {
                  const isActive        = selected?.id === f.id;
                  const vencida         = isFacturaVencida(f);
                  const porVencer       = isFacturaPorVencer(f);
                  const primaryGuia     = getFacturaPrimaryGuia(f);
                  const servicioRes     = getFacturaServicioResumen(f);
                  const cantGuias       = f.guias?.length ?? 0;
                  const tieneDetraccion =
                    Number(f.detraccionMonto) > 0 || Number(f.detraccionPorcentaje) > 0;

                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelected(isActive ? null : f)}
                      className={cn(
                        "cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50",
                        isActive && "bg-blue-50 hover:bg-blue-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-blue-600">
                          {f.serie}-{f.numero}
                        </span>
                        <FacturaStatusBadge estado={f.estadoPago} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {fechaCorta(f.fechaEmision)}
                        {f.fechaVencimiento && (
                          <span className={cn(
                            "ml-2",
                            vencida ? "font-medium text-red-600" :
                            porVencer ? "text-amber-600" : "text-slate-400"
                          )}>
                            · {vencida ? "Vencida" : porVencer ? "Por vencer" : fechaCorta(f.fechaVencimiento)}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm leading-tight text-slate-800">
                        {f.cliente?.razonSocial ?? "—"}
                        {f.cliente?.ruc && (
                          <span className="ml-1.5 text-[11px] text-slate-400">{f.cliente.ruc}</span>
                        )}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {fmtTotal(f.total, f.moneda)}
                        </span>
                        <FormaPagoBadge formaPago={f.formaPago} />
                        {tieneDetraccion && <AlertTag label="Detracción" color="blue" />}
                      </div>
                      {primaryGuia ? (
                        <p className="mt-1 font-mono text-xs text-slate-600">
                          {primaryGuia}
                          {cantGuias > 1 && (
                            <span className="ml-1 font-sans text-[10px] text-slate-400">
                              +{cantGuias - 1}
                            </span>
                          )}
                          {servicioRes && (
                            <span className="ml-1 font-sans text-slate-400">
                              · {[servicioRes.placa, servicioRes.ruta].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-400">Sin guía asociada</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Tabla desktop (md+) ── */}
              <div className="hidden md:block">
                <table className="w-full min-w-[860px] text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b bg-slate-50">
                      <th className="w-[128px] px-4 py-2.5 text-xs font-semibold text-slate-500">Documento</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Cliente</th>
                      <th className="w-[108px] px-4 py-2.5 text-xs font-semibold text-slate-500">Total</th>
                      <th className="w-[118px] px-4 py-2.5 text-xs font-semibold text-slate-500">Pago</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Guía / Servicio</th>
                      <th className="w-[148px] px-4 py-2.5 text-xs font-semibold text-slate-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => {
                      const isActive        = selected?.id === f.id;
                      const vencida         = isFacturaVencida(f);
                      const porVencer       = isFacturaPorVencer(f);
                      const primaryGuia     = getFacturaPrimaryGuia(f);
                      const servicioRes     = getFacturaServicioResumen(f);
                      const cantGuias       = f.guias?.length ?? 0;
                      const tieneDetraccion =
                        Number(f.detraccionMonto) > 0 || Number(f.detraccionPorcentaje) > 0;

                      return (
                        <tr
                          key={f.id}
                          onClick={() => setSelected(isActive ? null : f)}
                          className={cn(
                            "cursor-pointer border-b transition-colors hover:bg-slate-50",
                            isActive && "bg-blue-50 hover:bg-blue-50"
                          )}
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold leading-tight text-blue-600">
                              {f.serie}-{f.numero}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {fechaCorta(f.fechaEmision)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm leading-tight text-slate-800">
                              {f.cliente?.razonSocial ?? "—"}
                            </p>
                            {f.cliente?.ruc && (
                              <p className="mt-0.5 text-[11px] text-slate-400">{f.cliente.ruc}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium leading-tight text-slate-800">
                              {fmtTotal(f.total, f.moneda)}
                            </p>
                            {f.origenImportacion && (
                              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                                {f.origenImportacion}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <FormaPagoBadge formaPago={f.formaPago} />
                            {f.fechaVencimiento ? (
                              <p className={cn(
                                "mt-0.5 text-[11px] leading-tight",
                                vencida   ? "font-medium text-red-600"  :
                                porVencer ? "text-amber-600"            :
                                "text-slate-400"
                              )}>
                                {vencida ? "Vencida · " : porVencer ? "Vence · " : ""}
                                {fechaCorta(f.fechaVencimiento)}
                              </p>
                            ) : f.formaPago === "CREDITO" ? (
                              <p className="mt-0.5 text-[11px] text-amber-500">Sin vencimiento</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {primaryGuia ? (
                              <p className="font-mono text-xs leading-tight text-slate-700">
                                {primaryGuia}
                                {cantGuias > 1 && (
                                  <span className="ml-1 font-sans text-[10px] text-slate-400">
                                    +{cantGuias - 1}
                                  </span>
                                )}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400">Sin guía</p>
                            )}
                            {servicioRes ? (
                              <p className="mt-0.5 text-[11px] leading-tight text-slate-500 max-w-[200px] truncate"
                                 title={[servicioRes.placa, servicioRes.ruta].filter(Boolean).join(" · ")}>
                                {[servicioRes.placa, servicioRes.ruta].filter(Boolean).join(" · ")}
                              </p>
                            ) : (
                              <span className="mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset bg-red-50 text-red-500 ring-red-200">
                                Sin vincular
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <FacturaStatusBadge estado={f.estadoPago} />
                            <div className="mt-1 flex flex-wrap gap-1">
                              {tieneDetraccion && <AlertTag label="Detracción" color="blue" />}
                              {cantGuias === 0  && <AlertTag label="Sin guía"  color="slate" />}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {selected && (
          <div className="fixed inset-0 z-40 overflow-y-auto bg-white md:relative md:inset-auto md:z-auto md:w-96 md:shrink-0 md:border-l md:shadow-sm">
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
