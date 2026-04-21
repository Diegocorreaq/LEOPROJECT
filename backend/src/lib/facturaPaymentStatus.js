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

function computeFacturaPaymentStatus(facturaTotal, pagos, estadoActual) {
  const estado = typeof estadoActual === "string" ? estadoActual.trim().toUpperCase() : "";
  if (estado === "ANULADA") return "ANULADA";

  const total = Math.max(0, toNum(facturaTotal));
  const montoPagado = Math.max(0, sumPagos(pagos));
  const saldo = Math.max(0, total - montoPagado);

  if (saldo <= 0) return "PAGADA";
  if (montoPagado > 0) return "PARCIAL";
  return "PENDIENTE";
}

function computeFacturaPaymentSnapshot(facturaTotal, pagos, estadoActual) {
  const total = Math.max(0, toNum(facturaTotal));
  const montoPagado = Math.max(0, sumPagos(pagos));
  const saldo = Math.max(0, total - montoPagado);
  const status = computeFacturaPaymentStatus(total, pagos, estadoActual);
  const isAnulada = status === "ANULADA";

  return {
    status,
    total,
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
