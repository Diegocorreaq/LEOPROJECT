import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Receipt,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

export default function DashboardLiquidacionesTab({ rango, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(`/dashboard/liquidaciones?rango=${rango}`);
      setData(result);
    } catch (err) {
      setError(err.message ?? "Error al cargar el dashboard de liquidaciones");
    } finally {
      setLoading(false);
    }
  }, [rango, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const porEstado = data.porEstado ?? [];
  const serie = data.serie ?? [];
  const topConductores = data.topConductores ?? [];
  const pendientes = data.alertas?.pendientes ?? [];

  const totalEstados = porEstado.reduce((sum, item) => sum + Number(item.cantidad ?? 0), 0);

  const chartData = serie.map((item) => ({
    label: item.label,
    montoEntregado: Number(item.montoEntregado ?? 0),
    totalGastos: Number(item.totalGastos ?? 0),
    saldoNeto: Number(item.saldoNeto ?? 0),
  }));

  return (
    <div className="space-y-6 p-6">
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
          KPIs de liquidaciones
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard label="Liquidaciones del periodo" value={kpis.totalLiquidaciones} icon={FileSpreadsheet} color="slate" />
          <KpiCard label="Monto entregado" value={kpis.montoEntregado} icon={Wallet} color="blue" money />
          <KpiCard label="Total gastos" value={kpis.totalGastos} icon={Receipt} color="slate" money />
          <KpiCard label="Saldo neto" value={kpis.saldoNeto} icon={TrendingUp} color="green" money />
          <KpiCard label="Pendientes" value={kpis.pendientes} icon={Clock} color="amber" highlight />
          <KpiCard
            label="Favor empresa"
            value={kpis.favorEmpresa}
            icon={Building2}
            color="blue"
            sublabel={formatCurrency(kpis.montoFavorEmpresa)}
          />
          <KpiCard
            label="Favor conductor"
            value={kpis.favorConductor}
            icon={User}
            color="violet"
            sublabel={formatCurrency(kpis.montoFavorConductor)}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle>Distribución por estado</SectionTitle>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {(porEstado.length === 0 || totalEstados === 0) && (
              <p className="py-6 text-center text-sm text-slate-400">Sin liquidaciones en el periodo</p>
            )}

            {porEstado.map((estadoItem) => {
              const estado = estadoItem.estado;
              const cantidad = Number(estadoItem.cantidad ?? 0);
              const pct = totalEstados > 0 ? Math.round((cantidad / totalEstados) * 100) : 0;
              const isPendiente = estado === "PENDIENTE";

              return (
                <div
                  key={estado}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    isPendiente ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{estado}</span>
                    <span className={cn("font-bold", isPendiente ? "text-amber-700" : "text-green-700")}>
                      {formatCount(cantidad)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/60">
                    <div
                      className={cn("h-1.5 rounded-full transition-all", isPendiente ? "bg-amber-500" : "bg-green-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionTitle>Tendencia del periodo</SectionTitle>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {kpis.totalLiquidaciones > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatCompactMoney}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Line
                    type="monotone"
                    dataKey="montoEntregado"
                    name="Entregado"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalGastos"
                    name="Gastos"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldoNeto"
                    name="Saldo neto"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyBlock message="Sin tendencia disponible para el periodo seleccionado" />
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Top conductores</SectionTitle>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {topConductores.length === 0 ? (
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
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Entregado</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Gastos</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Saldo neto</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Pendientes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topConductores.map((conductor) => (
                    <tr key={conductor.conductorId} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-700">
                        <Link
                          to={`/liquidaciones?conductorId=${conductor.conductorId}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {conductor.conductorNombre}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatCount(conductor.cantidadLiquidaciones)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatCurrency(conductor.montoEntregado)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatCurrency(conductor.totalGastos)}</td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-right font-semibold",
                          Number(conductor.saldoNeto ?? 0) > 0
                            ? "text-green-700"
                            : Number(conductor.saldoNeto ?? 0) < 0
                              ? "text-amber-700"
                              : "text-slate-700",
                        )}
                      >
                        {formatCurrency(conductor.saldoNeto)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={cn(
                            "inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            conductor.pendientes > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {formatCount(conductor.pendientes)}
                        </span>
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
              Ir al módulo operativo
            </Link>
          }
        >
          Requieren atención
        </SectionTitle>
        <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
          {pendientes.length === 0 ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              No hay liquidaciones pendientes en el periodo
            </div>
          ) : (
            <div className="divide-y divide-amber-100">
              {pendientes.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.conductorNombre}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(item.fechaServicio)} · {item.ruta}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">
                        Entregado: {formatCurrency(item.montoEntregado)}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                        Gastos: {formatCurrency(item.totalGastos)}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 font-semibold",
                          Number(item.saldo ?? 0) > 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700",
                        )}
                      >
                        Saldo: {formatCurrency(item.saldo)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                      {item.diasPendiente}d pendiente
                    </span>
                    <Link
                      to={`/liquidaciones?liquidacionId=${item.id}`}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50"
                    >
                      Ver liquidación
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
