export const LIQUIDACION_STATUS = ["PENDIENTE", "LIQUIDADA", "CANCELADO", "OBSERVADA"];

export function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function coerceMoney(value) {
  if (value === "" || value == null) return 0;

  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;

  return roundCurrency(parsed);
}

export function computeDetalleSaldo({
  status,
  montoEntregado,
  viaticos,
  peajes,
  combustible,
  otros,
  galones,
  totalGastos,
  saldo,
}) {
  if (status === "CANCELADO") return "-";

  const hasMovement = [
    montoEntregado,
    viaticos,
    peajes,
    combustible,
    otros,
    galones,
    totalGastos,
  ].some((value) => Math.abs(Number(value || 0)) > 0);

  if (!hasMovement) return "";
  if (saldo < 0) return "A FAVOR DEL CONDUCTOR";
  if (saldo > 0) return "A FAVOR DE LA EMPRESA";
  return "-";
}

export function computeLiquidacion(values = {}) {
  const montoEntregado = coerceMoney(values.montoEntregado);
  const viaticos = coerceMoney(values.viaticos);
  const peajes = coerceMoney(values.peajes);
  const combustible = coerceMoney(values.combustible);
  const galones = coerceMoney(values.galones);
  const otros = coerceMoney(values.otros);
  const status = LIQUIDACION_STATUS.includes(values.status) ? values.status : "PENDIENTE";

  const totalGastos = roundCurrency(viaticos + peajes + combustible + otros);
  const saldo = roundCurrency(montoEntregado - totalGastos);
  const detalleSaldo = computeDetalleSaldo({
    status,
    montoEntregado,
    viaticos,
    peajes,
    combustible,
    otros,
    galones,
    totalGastos,
    saldo,
  });

  return {
    montoEntregado,
    viaticos,
    peajes,
    combustible,
    galones,
    otros,
    totalGastos,
    saldo,
    detalleSaldo,
    status,
  };
}
