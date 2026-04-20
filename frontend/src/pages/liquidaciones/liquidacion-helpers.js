import { formatDateOnly } from "@/lib/dateOnly";
import { computeLiquidacion, LIQUIDACION_STATUS } from "./computeLiquidacion";

export { computeLiquidacion, LIQUIDACION_STATUS };

export const LIQUIDACION_STATUS_CFG = {
  PENDIENTE: {
    label: "Pendiente",
    cls: "border border-amber-200 bg-amber-50 text-amber-700",
  },
  LIQUIDADA: {
    label: "Liquidada",
    cls: "border border-emerald-200 bg-emerald-50 text-emerald-700",
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
  const saldo = Number(liquidacion?.saldo ?? 0);
  if (saldo > 0) return "EMPRESA";
  if (saldo < 0) return "CONDUCTOR";
  return "NEUTRO";
}
