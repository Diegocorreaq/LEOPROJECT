import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDateLong } from "@/lib/dateOnly";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "-";
  return amount.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPeriodo(periodo) {
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const [year, month] = periodo.split("-");
  return `${meses[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

function formatDate(val) {
  if (!val) return "-";
  return formatDateLong(val);
}

const ESTADO_PAGO_CLASS = {
  PENDIENTE: "border-amber-200 bg-amber-50 text-amber-700",
  PARCIAL: "border-blue-200 bg-blue-50 text-blue-700",
  PAGADA: "border-green-200 bg-green-50 text-green-700",
  ANULADA: "border-slate-200 bg-slate-50 text-slate-500",
  OBSERVADA: "border-red-200 bg-red-50 text-red-700",
};

const ESTADO_PAGO_LABEL = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
  OBSERVADA: "Observada",
};

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sublabel, icon: Icon, color = "slate", currency = false }) {
  const iconColors = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
  };

  const displayValue = currency
    ? `S/ ${formatCurrency(value)}`
    : (value ?? "-");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 font-bold text-slate-900",
              currency ? "text-lg" : "text-2xl",
            )}
          >
            {displayValue}
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

function SectionTitle({ children }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
}

function EmptyRow({ message = "Sin registros" }) {
  return (
    <tr>
      <td colSpan={99} className="py-6 text-center text-sm text-slate-400">
        {message}
      </td>
    </tr>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1 font-semibold text-slate-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: S/ {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

// ─── main component ──────────────────────────────────────────────────────────

export default function DashboardCobranzaTab({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get("/dashboard/cobranza");
      setData(result);
    } catch (err) {
      setError(err.message ?? "Error al cargar el dashboard de cobranza");
    } finally {
      setLoading(false);
    }
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const { kpis, serieMensual, aging, topClientesDeuda, facturasCriticas } = data;

  // Format chart data with readable period labels
  const chartData = serieMensual.map((s) => ({
    ...s,
    label: formatPeriodo(s.periodo),
  }));

  // Aging entries for display
  const agingEntries = [
    { label: "Por vencer", value: aging.porVencer, color: "text-green-700", bg: "bg-green-50 border-green-200" },
    { label: "Vencido 1–7 días", value: aging.vencido_1_7, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
    { label: "Vencido 8–15 días", value: aging.vencido_8_15, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
    { label: "Vencido 16–30 días", value: aging.vencido_16_30, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { label: "Vencido +30 días", value: aging.vencido_mas_30, color: "text-red-800", bg: "bg-red-100 border-red-300" },
  ];

  const totalAging = agingEntries.reduce((s, e) => s + e.value, 0);

  return (
    <div className="space-y-6 p-6">
      {/* ── KPIs ── */}
      <section>
        <SectionTitle>KPIs de cobranza</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard
            label="Facturado mes"
            value={kpis.totalFacturadoMes}
            icon={TrendingUp}
            color="blue"
            currency
            sublabel="Mes actual"
          />
          <KpiCard
            label="Cobrado mes"
            value={kpis.totalCobradoMes}
            icon={CheckCircle2}
            color="green"
            currency
            sublabel="Mes actual"
          />
          <KpiCard
            label="Pendiente cobrar"
            value={kpis.pendientePorCobrar}
            icon={DollarSign}
            color="amber"
            currency
            sublabel="Cartera activa"
          />
          <KpiCard
            label="Fact. pendientes"
            value={kpis.facturasPendientes}
            icon={Clock}
            color="amber"
            sublabel="Total histórico"
          />
          <KpiCard
            label="Fact. parciales"
            value={kpis.facturasParciales}
            icon={Clock}
            color="blue"
            sublabel="Total histórico"
          />
          <KpiCard
            label="Fact. pagadas"
            value={kpis.facturasPagadas}
            icon={CheckCircle2}
            color="green"
            sublabel="Total histórico"
          />
          <KpiCard
            label="Fact. vencidas"
            value={kpis.facturasVencidas}
            icon={AlertTriangle}
            color="red"
            sublabel="Cartera activa"
          />
        </div>
      </section>

      {/* ── Gráfico mensual ── */}
      <section>
        <SectionTitle>Facturado vs. cobrado — últimos 6 meses</SectionTitle>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {chartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400">
              Sin datos en el período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
                barGap={4}
              >
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
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(name) =>
                    name === "facturado" ? "Facturado" : "Cobrado"
                  }
                />
                <Bar dataKey="facturado" name="facturado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cobrado" name="cobrado" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Aging + Top clientes ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Aging */}
        <div>
          <SectionTitle>Aging de cobranza</SectionTitle>
          <div className="space-y-2">
            {agingEntries.map((entry) => {
              const barPct = totalAging > 0 ? Math.round((entry.value / totalAging) * 100) : 0;
              return (
                <div
                  key={entry.label}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3",
                    entry.bg,
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700">{entry.label}</span>
                      <span className={cn("text-xs font-bold", entry.color)}>
                        S/ {formatCurrency(entry.value)}
                        <span className="ml-1 font-normal text-slate-500">({barPct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/60">
                      <div
                        className={cn("h-1.5 rounded-full transition-all", entry.color.replace("text-", "bg-"))}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs">
              <span className="font-medium text-slate-600">Total deuda</span>
              <span className="font-bold text-slate-900">S/ {formatCurrency(totalAging)}</span>
            </div>
          </div>
        </div>

        {/* Top clientes con deuda */}
        <div>
          <SectionTitle>Top clientes con deuda pendiente</SectionTitle>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {topClientesDeuda.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                Sin deuda pendiente
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left font-medium text-slate-500">Cliente</th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-500">Fact.</th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-500">
                        Pendiente
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-500">Vencido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topClientesDeuda.map((c) => (
                      <tr key={c.clienteId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <p className="max-w-[160px] truncate font-medium text-slate-800">
                            {c.clienteNombre}
                          </p>
                          <p className="text-[10px] text-slate-400">{c.ruc}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">
                          {c.cantidadFacturasPendientes}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                          S/ {formatCurrency(c.montoPendiente)}
                        </td>
                        <td className={cn(
                          "px-4 py-2.5 text-right font-semibold",
                          c.montoVencido > 0 ? "text-red-600" : "text-slate-400",
                        )}>
                          {c.montoVencido > 0 ? `S/ ${formatCurrency(c.montoVencido)}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Facturas críticas ── */}
      <section>
        <SectionTitle>Facturas críticas (vencidas con saldo)</SectionTitle>
        <div className="rounded-xl border border-red-200 bg-white shadow-sm">
          {facturasCriticas.length === 0 ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Sin facturas vencidas con saldo pendiente
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-medium text-slate-500">Factura</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-500">Cliente</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-500">Emisión</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-500">Vencimiento</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Total</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Pagado</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-500">Saldo</th>
                    <th className="px-4 py-2.5 text-center font-medium text-slate-500">Estado</th>
                    <th className="px-4 py-2.5 text-right font-medium text-red-500">Días</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {facturasCriticas.length === 0 ? (
                    <EmptyRow message="Sin facturas críticas" />
                  ) : (
                    facturasCriticas.map((f) => (
                      <tr
                        key={f.id}
                        className={cn(
                          "hover:bg-slate-50",
                          f.diasAtraso > 30 ? "bg-red-50/40" : "",
                        )}
                      >
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                          {f.numeroCompleto}
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-2.5 text-slate-700">
                          {f.clienteNombre}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{formatDate(f.fechaEmision)}</td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {formatDate(f.fechaVencimiento)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {formatCurrency(f.total)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-green-700">
                          {f.montoPagado > 0 ? formatCurrency(f.montoPagado) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-700">
                          {formatCurrency(f.saldoPendiente)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              ESTADO_PAGO_CLASS[f.estadoPago] ?? "",
                            )}
                          >
                            {ESTADO_PAGO_LABEL[f.estadoPago] ?? f.estadoPago}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "px-4 py-2.5 text-right font-bold",
                            f.diasAtraso > 30
                              ? "text-red-700"
                              : f.diasAtraso > 15
                              ? "text-red-500"
                              : f.diasAtraso > 7
                              ? "text-orange-600"
                              : "text-amber-600",
                          )}
                        >
                          {f.diasAtraso}d
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
