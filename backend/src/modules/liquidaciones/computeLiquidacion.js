const LIQUIDACION_STATUS = ["PENDIENTE", "LIQUIDADA"];

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function coerceMoney(value) {
  if (value === "" || value == null) return 0;

  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;

  return roundCurrency(parsed);
}

function coerceQuantity(value) {
  if (value === "" || value == null) return 0;

  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;

  return parsed;
}

function computeDetalleSaldo({
  montoEntregado,
  viaticos,
  peajes,
  combustible,
  otros,
  totalGastos,
  saldo,
}) {
  const hasMovement = [
    montoEntregado,
    viaticos,
    peajes,
    combustible,
    otros,
    totalGastos,
  ].some((value) => Math.abs(Number(value || 0)) > 0);

  if (!hasMovement) return "";
  if (saldo < 0) return "A FAVOR DEL CONDUCTOR";
  if (saldo > 0) return "A FAVOR DE LA EMPRESA";
  return "-";
}

function computeLiquidacion(values = {}) {
  const montoEntregado = coerceMoney(values.montoEntregado);
  const viaticos = coerceMoney(values.viaticos);
  const peajes = coerceMoney(values.peajes);
  const combustible = coerceMoney(values.combustible);
  const galones = coerceQuantity(values.galones);
  const otros = coerceMoney(values.otros);
  const status = LIQUIDACION_STATUS.includes(values.status) ? values.status : "PENDIENTE";

  const totalGastos = roundCurrency(viaticos + peajes + combustible + otros);
  const saldo = roundCurrency(montoEntregado - totalGastos);
  const detalleSaldo = computeDetalleSaldo({
    montoEntregado,
    viaticos,
    peajes,
    combustible,
    otros,
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

module.exports = {
  LIQUIDACION_STATUS,
  computeDetalleSaldo,
  computeLiquidacion,
  coerceMoney,
  coerceQuantity,
  roundCurrency,
};
