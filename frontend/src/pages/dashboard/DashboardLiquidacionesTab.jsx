import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  User,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/pages/liquidaciones/liquidacion-helpers";

function formatCompactMoney(value) {
  const amount = Number(value ?? 0);
  const abs = Math.abs(amount);
  if (abs >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(amount / 1000).toFixed(0)}k`;
  return `${Math.round(amount)}`;
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString("es-PE");
}

function KpiCard({ label, value, sublabel, icon: Icon, color = "slate", money = false, highlight = false }) {
  const iconColors = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm",
        highlight ? "border-amber-200" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn("mt-1 font-bold text-slate-900", money ? "text-lg" : "text-2xl")}>
            {money ? formatCurrency(value) : formatCount(value)}
          </p>
          {sublabel && <p className="mt-0.5 text-[11px] text-slate-400">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={cn("shrink-0 rounded-lg p-2", iconColors[color] ?? iconColors.slate)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}

function EmptyBlock({ message }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-400">
      {message}
    </div>
  );
}

const ConductorSaldoTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{row.conductorNombre}</p>
      <div className="space-y-0.5 text-slate-600">
        <p>
          Debe a la empresa: <span className="font-semibold text-blue-700">{formatCurrency(row.totalFavorEmpresaPendiente)}</span>
        </p>
        <p>
          La empresa le debe: <span className="font-semibold text-rose-700">{formatCurrency(row.totalFavorConductorPendiente)}</span>
        </p>
        <p>
          Saldo neto consolidado:{" "}
          <span
            className={cn(
              "font-semibold",
              Number(row.deudaNetaPendiente ?? 0) > 0
                ? "text-blue-700"
                : Number(row.deudaNetaPendiente ?? 0) < 0
                  ? "text-rose-700"
                  : "text-green-700",
            )}
          >
            {formatCurrency(row.deudaNetaPendiente)}
          </span>
        </p>
        <p>Liquidaciones: {formatCount(row.cantidadLiquidaciones)}</p>
        <p>Con saldo abierto: {formatCount(row.liquidacionesConPendienteReal)}</p>
      </div>
    </div>
  );
};

function truncateLabel(value, max = 28) {
  const text = String(value ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function formatConductorNombre(conductor) {
  if (!conductor) return "Sin conductor";
  return [conductor.nombre, conductor.apPaterno, conductor.apMaterno].filter(Boolean).join(" ").trim() || "Sin conductor";
}

export default function DashboardLiquidacionesTab({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conductores, setConductores] = useState([]);
  const [conductorSearch, setConductorSearch] = useState("");
  const [showConductorOptions, setShowConductorOptions] = useState(false);
  const [conductorId, setConductorId] = useState("");
  const [topOrder, setTopOrder] = useState("DEBEN_MAS_A_EMPRESA");
  const [loadingConductores, setLoadingConductores] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingConductores(true);
    api
      .get("/conductores?activo=true&limit=100")
      .then((result) => {
        if (!active) return;
        setConductores(Array.isArray(result) ? result : []);
      })
      .catch(() => {
        if (active) setConductores([]);
      })
      .finally(() => {
        if (active) setLoadingConductores(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ topOrder });
      if (conductorId) params.set("conductorId", conductorId);
      const result = await api.get(`/dashboard/liquidaciones?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err.message ?? "Error al cargar el dashboard de liquidaciones");
    } finally {
      setLoading(false);
    }
  }, [conductorId, refreshKey, topOrder]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-red-700">{error}</p>
        <button
          onClick={load}
          className="mt-3 rounded-lg border border-red-300 px-4 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) return null;

  const kpis = data.kpis ?? {};
  const porResultadoEconomico = (data.porResultadoEconomico ?? []).filter((item) => item.resultado !== "CUADRADA");
  const topConductores = data.topConductores ?? [];
  const selectedConductorSummary = data.selectedConductorSummary ?? null;
  const pendientes = data.alertas?.pendientes ?? [];
  const isConductorFiltered = Boolean(conductorId);
  const conductorSearchQuery = conductorSearch.trim().toLowerCase();
  const conductoresFiltrados = conductorSearchQuery
    ? conductores.filter((conductor) => {
      const nombre = formatConductorNombre(conductor).toLowerCase();
      const documento = String(conductor.nroDocumento ?? "").toLowerCase();
      return nombre.includes(conductorSearchQuery) || documento.includes(conductorSearchQuery);
    })
    : conductores;
  const conductoresSugeridos = conductoresFiltrados;

  function selectConductor(option) {
    if (!option) {
      setConductorId("");
      setConductorSearch("");
      setShowConductorOptions(false);
      return;
    }

    setConductorId(option.id);
    setConductorSearch(formatConductorNombre(option));
    setShowConductorOptions(false);
  }

  const totalResultados = porResultadoEconomico.reduce((sum, item) => sum + Number(item.cantidad ?? 0), 0);
  const conductorChartSource = isConductorFiltered
    ? (selectedConductorSummary ? [selectedConductorSummary] : [])
    : topConductores;
  const conductorChartData = conductorChartSource.map((item) => {
    const debeEmpresa = Number(item.totalFavorEmpresaPendiente ?? 0);
    const empresaDebe = -Number(item.totalFavorConductorPendiente ?? 0);
    return {
      conductorId: item.conductorId,
      conductorNombre: item.conductorNombre ?? "Sin conductor",
      cantidadLiquidaciones: Number(item.cantidadLiquidaciones ?? 0),
      liquidacionesConPendienteReal: Number(item.liquidacionesConPendienteReal ?? 0),
      totalFavorEmpresaPendiente: debeEmpresa,
      totalFavorConductorPendiente: Math.abs(empresaDebe),
      deudaNetaPendiente: Number(item.deudaNetaPendiente ?? 0),
      debeEmpresa,
      empresaDebe,
      saldoPendienteTotal: debeEmpresa + empresaDebe,
    };
  });
  const maxConcentracionSaldo = conductorChartData.reduce((max, item) => {
    const itemMax = Math.max(Math.abs(item.debeEmpresa), Math.abs(item.empresaDebe));
    return Math.max(max, itemMax);
  }, 0);
  const chartDomainMax = maxConcentracionSaldo > 0 ? Math.ceil(maxConcentracionSaldo * 1.1) : 1;
  const conductorChartHeight = Math.max(220, Math.min(520, conductorChartData.length * 46 + 72));

  return (
    <div className="space-y-6 p-6">
      <section>
        <SectionTitle>Filtros</SectionTitle>
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conductor</span>
            <div className="relative">
              <input
                type="text"
                value={conductorSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  setConductorSearch(value);
                  setShowConductorOptions(true);

                  if (conductorId) {
                    const selected = conductores.find((item) => item.id === conductorId);
                    const selectedName = formatConductorNombre(selected).toLowerCase();
                    if (selectedName !== value.trim().toLowerCase()) {
                      setConductorId("");
                    }
                  }
                }}
                onFocus={() => setShowConductorOptions(true)}
                onBlur={() => setTimeout(() => setShowConductorOptions(false), 120)}
                placeholder="Escribe para filtrar conductores..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                disabled={loadingConductores}
              />

              {showConductorOptions && !loadingConductores ? (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  <button
                    type="button"
                    className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectConductor(null)}
                  >
                    Todos
                  </button>

                  {conductoresSugeridos.map((conductor) => (
                    <button
                      key={conductor.id}
                      type="button"
                      className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectConductor(conductor)}
                    >
                      <p className="font-medium">{formatConductorNombre(conductor)}</p>
                      {conductor.nroDocumento ? (
                        <p className="text-xs text-slate-500">{conductor.nroDocumento}</p>
                      ) : null}
                    </button>
                  ))}

                  {conductoresSugeridos.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">Sin coincidencias</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orden top conductores</span>
            <select
              value={topOrder}
              onChange={(event) => setTopOrder(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              disabled={isConductorFiltered}
            >
              <option value="EMPRESA_LE_DEBE_MAS">Le deben mas</option>
              <option value="DEBEN_MAS_A_EMPRESA">Deben mas a la empresa</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <Link
              to="/liquidaciones"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Ver todas las liquidaciones
            </Link>
          }
        >
          KPIs y resultado economico
        </SectionTitle>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <KpiCard label="Sin rendicion" value={kpis.sinRendicion} icon={AlertTriangle} color="amber" />
                <KpiCard label="Saldo neto pendiente" value={kpis.saldoNeto} icon={Wallet} color="slate" money />
                <KpiCard
                  label="Deben a la empresa"
                  value={kpis.favorEmpresa}
                  icon={Building2}
                  color="blue"
                  sublabel={formatCurrency(kpis.totalFavorEmpresaPendiente ?? kpis.montoFavorEmpresa)}
                />
                <KpiCard
                  label="La empresa les debe"
                  value={kpis.favorConductor}
                  icon={User}
                  color="violet"
                  sublabel={formatCurrency(kpis.totalFavorConductorPendiente ?? kpis.montoFavorConductor)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 lg:col-span-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Resultado economico</p>
              {(porResultadoEconomico.length === 0 || totalResultados === 0) && (
                <p className="py-6 text-center text-sm text-slate-400">Sin datos en el periodo</p>
              )}
              <div className="space-y-2">
                {porResultadoEconomico.map((item) => {
                  const qty = Number(item.cantidad ?? 0);
                  const pct = totalResultados > 0 ? Math.round((qty / totalResultados) * 100) : 0;
                  return (
                    <div key={item.resultado} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{item.resultado}</span>
                        <span className="font-bold text-slate-700">
                          {formatCount(qty)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200">
                        <div className="h-1.5 rounded-full bg-slate-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Concentracion del saldo pendiente por conductor</SectionTitle>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs text-slate-500">
            Derecha: el conductor debe a la empresa. Izquierda: la empresa le debe al conductor.
          </p>
          {conductorChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={conductorChartHeight}>
              <BarChart
                data={conductorChartData}
                layout="vertical"
                margin={{ top: 8, right: 20, left: 12, bottom: 8 }}
                barCategoryGap={10}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-chartDomainMax, chartDomainMax]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatCompactMoney(Math.abs(Number(value ?? 0)))}
                />
                <YAxis
                  type="category"
                  dataKey="conductorNombre"
                  width={220}
                  tick={{ fontSize: 11, fill: "#334155" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => truncateLabel(value, 30)}
                />
                <ReferenceLine x={0} stroke="#64748b" strokeDasharray="4 4" />
                <Tooltip content={<ConductorSaldoTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="empresaDebe" name="La empresa le debe" fill="#e11d48" />
                <Bar dataKey="debeEmpresa" name="Debe a la empresa" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyBlock
              message={
                isConductorFiltered
                  ? "El conductor seleccionado no tiene saldos pendientes abiertos."
                  : "Sin saldos pendientes para mostrar por conductor."
              }
            />
          )}
        </div>
      </section>

      <section>
        <SectionTitle>
          {isConductorFiltered
            ? "Resumen del conductor seleccionado"
            : topOrder === "EMPRESA_LE_DEBE_MAS"
              ? "Top conductores - la empresa les debe mas"
              : "Top conductores - deben mas a la empresa"}
        </SectionTitle>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {isConductorFiltered ? (
            !selectedConductorSummary ? (
              <div className="flex h-24 items-center justify-center text-sm text-slate-400">
                Sin datos para el conductor filtrado
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Conductor</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedConductorSummary.conductorNombre}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Debe a la empresa</p>
                  <p className="text-sm font-semibold text-blue-700">
                    {formatCurrency(selectedConductorSummary.totalFavorEmpresaPendiente)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">La empresa le debe</p>
                  <p className="text-sm font-semibold text-rose-700">
                    {formatCurrency(selectedConductorSummary.totalFavorConductorPendiente)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Liquidaciones</p>
                  <p className="text-sm font-semibold text-slate-800">{formatCount(selectedConductorSummary.cantidadLiquidaciones)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Con saldo abierto</p>
                  <p className="text-sm font-semibold text-amber-700">
                    {formatCount(selectedConductorSummary.liquidacionesConPendienteReal)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Saldo neto consolidado</p>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      Number(selectedConductorSummary.deudaNetaPendiente ?? 0) > 0
                        ? "text-blue-700"
                        : Number(selectedConductorSummary.deudaNetaPendiente ?? 0) < 0
                          ? "text-rose-700"
                          : "text-green-700",
                    )}
                  >
                    {formatCurrency(selectedConductorSummary.deudaNetaPendiente)}
                  </p>
                </div>
              </div>
            )
          ) : topConductores.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-400">
              Sin conductores relevantes en este periodo
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-medium text-slate-500">Conductor</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Liquidaciones</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Con saldo abierto</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Debe a la empresa</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">La empresa le debe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topConductores.map((conductor) => (
                    <tr key={conductor.conductorId} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-700">
                        <button
                          type="button"
                          onClick={() => {
                            setConductorId(conductor.conductorId);
                            setConductorSearch(conductor.conductorNombre);
                            setShowConductorOptions(false);
                          }}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {conductor.conductorNombre}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatCount(conductor.cantidadLiquidaciones)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {formatCount(conductor.liquidacionesConPendienteReal)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-blue-700">
                        {formatCurrency(conductor.totalFavorEmpresaPendiente)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-rose-700">
                        {formatCurrency(conductor.totalFavorConductorPendiente)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <Link to="/liquidaciones" className="text-xs text-amber-600 hover:underline">
              Ir al modulo operativo
            </Link>
          }
        >
          Liquidaciones abiertas
        </SectionTitle>
        <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
          {pendientes.length === 0 ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              No hay liquidaciones con saldo pendiente en el periodo
            </div>
          ) : (
            <div className="divide-y divide-amber-100">
              {pendientes.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.conductorNombre}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(item.fechaServicio)} - {item.ruta}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                        Base: {formatCurrency(item.saldo)}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 font-semibold",
                          Number(item.saldoPendiente ?? 0) > 0 ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700",
                        )}
                      >
                        {Number(item.saldoPendiente ?? 0) > 0 ? "Debe a la empresa" : "La empresa le debe"}: {formatCurrency(item.saldoPendiente)}
                      </span>
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">
                        {item.estadoRegularizacion}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                      {item.diasPendiente}d abierto
                    </span>
                    <Link
                      to={`/liquidaciones?liquidacionId=${item.id}`}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50"
                    >
                      Ver liquidacion
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
