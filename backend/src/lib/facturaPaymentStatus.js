function toNum(value) {
  if (value == null) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function sumPagos(pagos) {
  if (!Array.isArray(pagos) || pagos.length === 0) return 0;

  return pagos.reduce((sum, pago) => {
    const monto = typeof pago === "number" ? pago : pago?.monto;
    return sum + toNum(monto);
  }, 0);
}

function resolveTotalCobranza(facturaTotal, detraccionMonto = 0) {
  const total = Math.max(0, toNum(facturaTotal));
  const detraccion = Math.max(0, toNum(detraccionMonto));
  return Math.max(0, total - detraccion);
}

function computeFacturaPaymentStatus(facturaTotal, pagos, estadoActual, detraccionMonto = 0) {
  const estado = typeof estadoActual === "string" ? estadoActual.trim().toUpperCase() : "";
  if (estado === "ANULADA") return "ANULADA";

  const total = Math.max(0, toNum(facturaTotal));
  const totalCobranza = resolveTotalCobranza(total, detraccionMonto);
  const montoPagado = Math.max(0, sumPagos(pagos));
  const saldo = Math.max(0, totalCobranza - montoPagado);

  if (saldo <= 0) return "PAGADA";
  if (montoPagado > 0) return "PARCIAL";
  return "PENDIENTE";
}

function computeFacturaPaymentSnapshot(facturaTotal, pagos, estadoActual, detraccionMonto = 0) {
  const total = Math.max(0, toNum(facturaTotal));
  const detraccion = Math.max(0, toNum(detraccionMonto));
  const totalCobranza = resolveTotalCobranza(total, detraccion);
  const montoPagado = Math.max(0, sumPagos(pagos));
  const saldo = Math.max(0, totalCobranza - montoPagado);
  const status = computeFacturaPaymentStatus(total, pagos, estadoActual, detraccion);
  const isAnulada = status === "ANULADA";

  return {
    status,
    total,
    detraccion,
    totalCobranza,
    montoPagado,
    saldo,
    isAnulada,
    isClosed: isAnulada || saldo <= 0,
  };
}

module.exports = {
  computeFacturaPaymentStatus,
  computeFacturaPaymentSnapshot,
};
