import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  FileText,
  Receipt,
  Wallet,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(val) {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pct(num, total) {
  if (!total) return 0;
  return Math.round((num / total) * 100);
}

const ESTADO_PAGO_LABEL = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
  OBSERVADA: "Observada",
};

const ESTADO_PAGO_CLASS = {
  PENDIENTE: "border-amber-200 bg-amber-50 text-amber-700",
  PARCIAL: "border-blue-200 bg-blue-50 text-blue-700",
  PAGADA: "border-green-200 bg-green-50 text-green-700",
  ANULADA: "border-slate-200 bg-slate-50 text-slate-500",
  OBSERVADA: "border-red-200 bg-red-50 text-red-700",
};

const ESTADO_SERVICIO_CLASS = {
  PROGRAMADO: "border-blue-200 bg-blue-50 text-blue-700",
  EN_TRANSITO: "border-amber-200 bg-amber-50 text-amber-700",
  FINALIZADO: "border-green-200 bg-green-50 text-green-700",
  COMPLETADO: "border-green-200 bg-green-50 text-green-700",
  CANCELADO: "border-slate-200 bg-slate-50 text-slate-500",
};

function formatEstadoServicio(estado) {
  return estado === "COMPLETADO" ? "FINALIZADO" : estado;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color = "slate", alert = false, sublabel }) {
  const iconColors = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm",
        alert ? "border-red-200" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              alert && value > 0 ? "text-red-600" : "text-slate-900",
            )}
          >
            {value ?? "-"}
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

function FlowStep({ label, value, total, highlight = false, warning = false }) {
  const p = pct(value, total);
  return (
    <div
      className={cn(
        "flex-1 rounded-xl border bg-white p-4 shadow-sm",
        warning ? "border-amber-200" : "border-slate-200",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold",
          warning ? "text-amber-700" : highlight ? "text-green-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {total > 0 && (
        <p className="mt-0.5 text-xs text-slate-400">{p}% del total</p>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function DashboardGeneralTab({ rango, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(`/dashboard/general?rango=${rango}`);
      setData(result);
    } catch (err) {
      setError(err.message ?? "Error al cargar el dashboard");
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

  const { kpis, flujo, alertas, actividadReciente } = data;

  return (
    <div className="space-y-6 p-6">
      {/* ── KPIs ── */}
      <section>
        <SectionTitle>KPIs principales</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard label="Servicios hoy" value={kpis.serviciosHoy} icon={Truck} color="blue" />
          <KpiCard
            label="Servicios semana"
            value={kpis.serviciosSemana}
            icon={Truck}
            color="slate"
          />
          <KpiCard
            label="Guías sin vincular"
            value={kpis.guiasSinVincular}
            icon={FileText}
            color="amber"
            alert={kpis.guiasSinVincular > 0}
          />
          <KpiCard
            label="Facturas sin vincular"
            value={kpis.facturasSinVincular}
            icon={Receipt}
            color="orange"
            alert={kpis.facturasSinVincular > 0}
          />
          <KpiCard
            label="Pendientes de pago"
            value={kpis.facturasPendientesPago}
            icon={Clock}
            color="amber"
          />
          <KpiCard
            label="Facturas vencidas"
            value={kpis.facturasVencidas}
            icon={AlertTriangle}
            color="red"
            alert={kpis.facturasVencidas > 0}
          />
          <KpiCard
            label="Liquidaciones pend."
            value={kpis.liquidacionesPendientes}
            icon={Wallet}
            color="slate"
          />
        </div>
      </section>

      {/* ── Flujo documental ── */}
      <section>
        <SectionTitle>Flujo documental (período seleccionado)</SectionTitle>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <FlowStep
            label="Servicios"
            value={flujo.serviciosTotal}
            total={flujo.serviciosTotal}
            highlight
          />
          <div className="hidden items-center sm:flex">
            <ArrowRight className="h-5 w-5 text-slate-300" />
          </div>
          <FlowStep
            label="Con guía"
            value={flujo.serviciosConGuia}
            total={flujo.serviciosTotal}
            highlight={pct(flujo.serviciosConGuia, flujo.serviciosTotal) >= 80}
          />
          <div className="hidden items-center sm:flex">
            <ArrowRight className="h-5 w-5 text-slate-300" />
          </div>
          <FlowStep
            label="Con factura"
            value={flujo.serviciosConFactura}
            total={flujo.serviciosTotal}
            highlight={pct(flujo.serviciosConFactura, flujo.serviciosTotal) >= 80}
          />
          <div className="hidden items-center sm:flex">
            <ArrowRight className="h-5 w-5 text-slate-300" />
          </div>
          <FlowStep
            label="Facturas pagadas"
            value={flujo.facturasConPago}
            total={flujo.serviciosTotal}
          />
        </div>

        {/* Brechas */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {flujo.serviciosConGuiaSinFactura > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{flujo.serviciosConGuiaSinFactura}</strong> servicios con guía pero sin
                factura
              </span>
            </div>
          )}
          {flujo.facturasSinServicio > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{flujo.facturasSinServicio}</strong> facturas sin servicio vinculado
              </span>
            </div>
          )}
          {flujo.facturasSinPago > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{flujo.facturasSinPago}</strong> facturas sin pago registrado
              </span>
            </div>
          )}
          {flujo.serviciosConGuiaSinFactura === 0 &&
            flujo.facturasSinServicio === 0 &&
            flujo.facturasSinPago === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 sm:col-span-3">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Sin brechas detectadas en el período seleccionado</span>
              </div>
            )}
        </div>
      </section>

      {/* ── Alertas ── */}
      <section>
        <SectionTitle>Alertas operativas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Guías sin vincular */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-700">
                  Guías sin vincular recientes
                </span>
              </div>
              <Link
                to="/guias"
                className="text-xs text-amber-600 hover:underline"
              >
                Ver todas
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Guía</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Destinatario</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Emisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertas.guiasSinVincularRecientes.length === 0 ? (
                    <EmptyRow message="Sin guías pendientes" />
                  ) : (
                    alertas.guiasSinVincularRecientes.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-700">
                          {g.serie}-{g.numero}
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-2 text-slate-600">
                          {g.destinatarioNombre ?? "-"}
                        </td>
                        <td className="px-4 py-2 text-slate-500">{formatDate(g.fechaEmision)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Facturas vencidas */}
          <div className="rounded-xl border border-red-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-red-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-slate-700">Facturas vencidas</span>
              </div>
              <Link to="/facturacion" className="text-xs text-red-600 hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Factura</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Cliente</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">Días</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertas.facturasVencidas.length === 0 ? (
                    <EmptyRow message="Sin facturas vencidas" />
                  ) : (
                    alertas.facturasVencidas.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-700">
                          {f.serie}-{f.numero}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-2 text-slate-600">
                          {f.cliente?.razonSocial ?? "-"}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-red-600">
                          {f.diasAtraso}d
                        </td>
                        <td className="px-4 py-2 text-right text-slate-700">
                          {f.total.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Facturas observadas / sin vincular */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-slate-700">
                  Facturas observadas / sin vincular
                </span>
              </div>
              <Link to="/facturacion" className="text-xs text-orange-600 hover:underline">
                Ver todas
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Factura</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Cliente</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Estado</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertas.facturasObservadasRecientes.length === 0 ? (
                    <EmptyRow message="Sin observaciones" />
                  ) : (
                    alertas.facturasObservadasRecientes.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-700">
                          {f.serie}-{f.numero}
                        </td>
                        <td className="max-w-[130px] truncate px-4 py-2 text-slate-600">
                          {f.cliente?.razonSocial ?? "-"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              ESTADO_PAGO_CLASS[f.estadoPago] ?? "border-slate-200 bg-slate-50 text-slate-600",
                            )}
                          >
                            {ESTADO_PAGO_LABEL[f.estadoPago] ?? f.estadoPago}
                            {!f.ordenServicioId && " · Sin vincular"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-700">
                          {f.total.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Servicios sin documentos */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">
                  Servicios sin guías (período)
                </span>
              </div>
              <Link to="/servicios" className="text-xs text-slate-500 hover:underline">
                Ver todos
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Fecha</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Ruta</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertas.serviciosSinDocumentos.length === 0 ? (
                    <EmptyRow message="Todos los servicios tienen guía" />
                  ) : (
                    alertas.serviciosSinDocumentos.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-500">{formatDate(s.fechaServicio)}</td>
                        <td className="max-w-[180px] truncate px-4 py-2 text-slate-600">
                          {s.origen} → {s.destino}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              ESTADO_SERVICIO_CLASS[formatEstadoServicio(s.estado)] ??
                                "border-slate-200 bg-slate-50 text-slate-600",
                            )}
                          >
                            {formatEstadoServicio(s.estado)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Actividad reciente ── */}
      <section>
        <SectionTitle>Actividad reciente</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Últimas guías */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Últimas guías importadas</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {actividadReciente.ultimasGuias.length === 0 ? (
                <li className="py-6 text-center text-sm text-slate-400">Sin registros</li>
              ) : (
                actividadReciente.ultimasGuias.map((g) => (
                  <li key={g.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-800">
                        {g.serie}-{g.numero}
                      </p>
                      <p className="max-w-[160px] truncate text-[11px] text-slate-500">
                        {g.destinatarioNombre ?? g.remitenteNombre ?? "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-400">{formatDate(g.fechaEmision)}</p>
                      {!g.servicioId && (
                        <span className="text-[10px] font-medium text-amber-600">Sin vincular</span>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Últimas facturas */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">
                Últimas facturas importadas
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {actividadReciente.ultimasFacturas.length === 0 ? (
                <li className="py-6 text-center text-sm text-slate-400">Sin registros</li>
              ) : (
                actividadReciente.ultimasFacturas.map((f) => (
                  <li key={f.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-800">
                        {f.serie}-{f.numero}
                      </p>
                      <p className="max-w-[140px] truncate text-[11px] text-slate-500">
                        {f.cliente?.razonSocial ?? "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-700">
                        {f.total.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                          ESTADO_PAGO_CLASS[f.estadoPago] ?? "",
                        )}
                      >
                        {ESTADO_PAGO_LABEL[f.estadoPago] ?? f.estadoPago}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Últimos pagos */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Últimos pagos registrados</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {actividadReciente.ultimosPagos.length === 0 ? (
                <li className="py-6 text-center text-sm text-slate-400">Sin pagos registrados</li>
              ) : (
                actividadReciente.ultimosPagos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50">
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-800">
                        {p.factura?.serie}-{p.factura?.numero}
                      </p>
                      <p className="max-w-[140px] truncate text-[11px] text-slate-500">
                        {p.factura?.cliente?.razonSocial ?? "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-green-700">
                        +{p.monto.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatDate(p.fechaPago)}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
