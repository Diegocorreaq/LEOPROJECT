import { formatDateOnly } from "@/lib/dateOnly";
import { computeLiquidacion, LIQUIDACION_STATUS } from "./computeLiquidacion";

export { computeLiquidacion, LIQUIDACION_STATUS };

export const LIQUIDACION_STATUS_CFG = {
  PENDIENTE: {
    label: "Pendiente de rendicion",
    cls: "border border-amber-200 bg-amber-50 text-amber-700",
  },
  LIQUIDADA: {
    label: "Liquidada",
    cls: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

export const LIQUIDACION_RESULTADO_ECONOMICO_CFG = {
  SIN_RENDICION: {
    label: "Pendiente de rendicion",
    cls: "border border-amber-200 bg-amber-50 text-amber-700",
  },
  CUADRADA: {
    label: "Cuadrada",
    cls: "border border-green-200 bg-green-50 text-green-700",
  },
  FAVOR_EMPRESA: {
    label: "Favor empresa",
    cls: "border border-blue-200 bg-blue-50 text-blue-700",
  },
  FAVOR_CONDUCTOR: {
    label: "Favor conductor",
    cls: "border border-rose-200 bg-rose-50 text-rose-700",
  },
};

export const LIQUIDACION_REGULARIZACION_CFG = {
  SIN_SALDO: {
    label: "Sin saldo",
    cls: "border border-green-200 bg-green-50 text-green-700",
  },
  PENDIENTE_REGULARIZAR: {
    label: "Pendiente de regularizar",
    cls: "border border-amber-200 bg-amber-50 text-amber-700",
  },
  PARCIALMENTE_COMPENSADA: {
    label: "Parcialmente compensada",
    cls: "border border-blue-200 bg-blue-50 text-blue-700",
  },
  COMPENSADA: {
    label: "Compensada",
    cls: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

export const LIQUIDACION_SALDO_MOVIMIENTO_TIPOS = [
  "COMPENSACION_ENTRE_LIQUIDACIONES",
  "DEVOLUCION_A_EMPRESA",
  "PAGO_A_CONDUCTOR",
  "AJUSTE_MANUAL",
];

export const LIQUIDACION_SALDO_MOVIMIENTO_CFG = {
  COMPENSACION_ENTRE_LIQUIDACIONES: {
    label: "Compensacion entre liquidaciones",
    cls: "border border-blue-200 bg-blue-50 text-blue-700",
  },
  DEVOLUCION_A_EMPRESA: {
    label: "Devolucion a empresa",
    cls: "border border-slate-200 bg-slate-100 text-slate-700",
  },
  PAGO_A_CONDUCTOR: {
    label: "Pago a conductor",
    cls: "border border-rose-200 bg-rose-50 text-rose-700",
  },
  AJUSTE_MANUAL: {
    label: "Ajuste manual",
    cls: "border border-violet-200 bg-violet-50 text-violet-700",
  },
};

export function formatCurrency(value) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount) || !Number.isFinite(amount)) return "S/ 0.00";

  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value, options = {}) {
  if (!value) return "-";
  return formatDateOnly(value, { day: "2-digit", month: "short", year: "numeric", ...options });
}

export function getConductorNombre(conductor) {
  if (!conductor) return "-";
  return (
    conductor.nombreCompleto ??
    [conductor.nombre, conductor.apPaterno, conductor.apMaterno].filter(Boolean).join(" ") ??
    "-"
  );
}

export function getServicioReferencia(servicio) {
  if (!servicio?.id) return "-";
  return `SRV-${servicio.id.slice(0, 8).toUpperCase()}`;
}

export function getClienteReferencia(servicio) {
  if (!servicio) return "-";
  if (servicio.clienteReferencia) return servicio.clienteReferencia;

  const guiaPagador = (servicio.guias ?? []).find((guia) => guia.pagadorFleteNombre);
  if (guiaPagador?.pagadorFleteNombre) return guiaPagador.pagadorFleteNombre;

  return servicio.clientes?.[0]?.cliente?.razonSocial ?? servicio.clientes?.[0]?.razonSocial ?? "-";
}

export function getRutaLabel(servicio) {
  if (!servicio) return "-";
  return [servicio.origen, servicio.destino].filter(Boolean).join(" -> ") || "-";
}

export function getSaldoFavorTag(liquidacion) {
  const saldo = Number(liquidacion?.saldoPendiente ?? liquidacion?.saldo ?? 0);
  if (saldo > 0) return "EMPRESA";
  if (saldo < 0) return "CONDUCTOR";
  return "NEUTRO";
}

export function getResultadoEconomicoConfig(liquidacion) {
  const key = liquidacion?.resultadoEconomico;
  return LIQUIDACION_RESULTADO_ECONOMICO_CFG[key] ?? {
    label: key || "-",
    cls: "border border-slate-200 bg-slate-100 text-slate-700",
  };
}

export function getRegularizacionConfig(liquidacion) {
  const key = liquidacion?.estadoRegularizacion;
  return LIQUIDACION_REGULARIZACION_CFG[key] ?? {
    label: key || "-",
    cls: "border border-slate-200 bg-slate-100 text-slate-700",
  };
}

export function getMovimientoSaldoConfig(tipo) {
  const key = (tipo ?? "").toUpperCase();
  return LIQUIDACION_SALDO_MOVIMIENTO_CFG[key] ?? {
    label: key || "Movimiento",
    cls: "border border-slate-200 bg-slate-100 text-slate-700",
  };
}

export function hasSaldoPendiente(liquidacion) {
  return Math.abs(Number(liquidacion?.saldoPendiente ?? liquidacion?.saldo ?? 0)) > 0;
}
