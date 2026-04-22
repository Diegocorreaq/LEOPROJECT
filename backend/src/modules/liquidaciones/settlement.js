const { roundCurrency } = require("./computeLiquidacion");

const LIQUIDACION_RESULTADO_ECONOMICO = ["SIN_RENDICION", "CUADRADA", "FAVOR_EMPRESA", "FAVOR_CONDUCTOR"];
const LIQUIDACION_REGULARIZACION_STATUS = [
  "SIN_SALDO",
  "PENDIENTE_REGULARIZAR",
  "PARCIALMENTE_COMPENSADA",
  "COMPENSADA",
];
const LIQUIDACION_SALDO_MOVIMIENTO_TIPOS = [
  "COMPENSACION_ENTRE_LIQUIDACIONES",
  "DEVOLUCION_A_EMPRESA",
  "PAGO_A_CONDUCTOR",
  "AJUSTE_MANUAL",
];

const EPSILON = 0.000001;
const POSITIVE_SALDO_ALLOWED_MOVEMENTS = new Set([
  "COMPENSACION_ENTRE_LIQUIDACIONES",
  "DEVOLUCION_A_EMPRESA",
  "AJUSTE_MANUAL",
]);
const NEGATIVE_SALDO_ALLOWED_MOVEMENTS = new Set([
  "COMPENSACION_ENTRE_LIQUIDACIONES",
  "PAGO_A_CONDUCTOR",
  "AJUSTE_MANUAL",
]);

function toNumber(value) {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value) {
  return normalizeZero(roundCurrency(toNumber(value)));
}

function normalizeZero(value) {
  if (Math.abs(value) < EPSILON) return 0;
  return value;
}

function normalizeTipoMovimiento(tipo) {
  return typeof tipo === "string" ? tipo.trim().toUpperCase() : "";
}

function normalizeLiquidacionStatus(status) {
  return typeof status === "string" ? status.trim().toUpperCase() : "PENDIENTE";
}

function resolveSaldoFavorTag(saldo) {
  const parsed = toMoney(saldo);
  if (parsed > 0) return "EMPRESA";
  if (parsed < 0) return "CONDUCTOR";
  return "NEUTRO";
}

function isSinRendicion(liquidacion) {
  const status = normalizeLiquidacionStatus(liquidacion?.status);
  if (status !== "LIQUIDADA") return true;

  const montoEntregado = toMoney(liquidacion?.montoEntregado);
  const totalGastos = toMoney(liquidacion?.totalGastos);
  return montoEntregado > 0 && totalGastos <= 0;
}

function resolveLiquidacionResultadoEconomico(liquidacion) {
  if (isSinRendicion(liquidacion)) return "SIN_RENDICION";

  const saldoBase = toMoney(liquidacion?.saldo);
  if (saldoBase > 0) return "FAVOR_EMPRESA";
  if (saldoBase < 0) return "FAVOR_CONDUCTOR";
  return "CUADRADA";
}

function movementAffectsLiquidacion(movimiento, liquidacionId) {
  return (
    movimiento?.liquidacionOrigenId === liquidacionId ||
    movimiento?.liquidacionDestinoId === liquidacionId
  );
}

function resolveAllowedMovementTypes(saldoBase) {
  if (saldoBase > 0) return POSITIVE_SALDO_ALLOWED_MOVEMENTS;
  if (saldoBase < 0) return NEGATIVE_SALDO_ALLOWED_MOVEMENTS;
  return null;
}

function computeMovimientoAplicadoTotal(liquidacionId, saldoBase, movimientos = []) {
  const allowedTypes = resolveAllowedMovementTypes(saldoBase);
  if (!allowedTypes || Math.abs(saldoBase) < EPSILON) return 0;

  const sum = movimientos.reduce((acc, movimiento) => {
    if (!movementAffectsLiquidacion(movimiento, liquidacionId)) return acc;

    const tipo = normalizeTipoMovimiento(movimiento.tipo);
    if (!allowedTypes.has(tipo)) return acc;

    return acc + Math.abs(toMoney(movimiento.monto));
  }, 0);

  return normalizeZero(roundCurrency(sum));
}

function computeLiquidacionSaldoPendiente({ liquidacionId, saldoBase, movimientos = [] }) {
  const base = toMoney(saldoBase);
  if (Math.abs(base) < EPSILON) {
    return {
      saldoBase: 0,
      montoAplicado: 0,
      montoPendienteAbsoluto: 0,
      saldoPendiente: 0,
      porcentajeRegularizado: 100,
    };
  }

  const aplicadoBruto = computeMovimientoAplicadoTotal(liquidacionId, base, movimientos);
  const aplicado = Math.min(Math.abs(base), aplicadoBruto);
  const pendienteAbs = normalizeZero(roundCurrency(Math.max(0, Math.abs(base) - aplicado)));
  const saldoPendiente = normalizeZero(base > 0 ? pendienteAbs : -pendienteAbs);
  const porcentajeRegularizado = Math.min(100, roundCurrency((aplicado / Math.abs(base)) * 100));

  return {
    saldoBase: base,
    montoAplicado: normalizeZero(roundCurrency(aplicado)),
    montoPendienteAbsoluto: pendienteAbs,
    saldoPendiente,
    porcentajeRegularizado,
  };
}

function resolveRegularizacionStatus(saldoBase, montoAplicado) {
  const baseAbs = Math.abs(toMoney(saldoBase));
  const aplicado = normalizeZero(toMoney(montoAplicado));

  if (baseAbs < EPSILON) return "SIN_SALDO";
  if (aplicado < EPSILON) return "PENDIENTE_REGULARIZAR";
  if (aplicado + EPSILON < baseAbs) return "PARCIALMENTE_COMPENSADA";
  return "COMPENSADA";
}

function getLiquidacionEstadoFinanciero({ liquidacion, movimientos = [] }) {
  const liquidacionId = liquidacion?.id ?? null;
  const resultadoEconomico = resolveLiquidacionResultadoEconomico(liquidacion);
  const settlement = computeLiquidacionSaldoPendiente({
    liquidacionId,
    saldoBase: liquidacion?.saldo,
    movimientos,
  });
  const estadoRegularizacion = resolveRegularizacionStatus(settlement.saldoBase, settlement.montoAplicado);

  return {
    estadoRendicion: normalizeLiquidacionStatus(liquidacion?.status),
    resultadoEconomico,
    estadoRegularizacion,
    saldoBase: settlement.saldoBase,
    saldoPendiente: settlement.saldoPendiente,
    montoRegularizado: settlement.montoAplicado,
    montoPendienteAbsoluto: settlement.montoPendienteAbsoluto,
    porcentajeRegularizado: settlement.porcentajeRegularizado,
    favorSaldoBase: resolveSaldoFavorTag(settlement.saldoBase),
    favorSaldoPendiente: resolveSaldoFavorTag(settlement.saldoPendiente),
    requiereRegularizacion: Math.abs(settlement.saldoBase) > EPSILON,
    tieneMovimientosSaldo: Array.isArray(movimientos) && movimientos.length > 0,
    cantidadMovimientosSaldo: Array.isArray(movimientos) ? movimientos.length : 0,
  };
}

function groupMovimientosByLiquidacion(movimientos = []) {
  const grouped = new Map();

  for (const movimiento of movimientos) {
    const originId = movimiento?.liquidacionOrigenId;
    const destinationId = movimiento?.liquidacionDestinoId;

    if (originId) {
      if (!grouped.has(originId)) grouped.set(originId, []);
      grouped.get(originId).push(movimiento);
    }

    if (destinationId) {
      if (!grouped.has(destinationId)) grouped.set(destinationId, []);
      grouped.get(destinationId).push(movimiento);
    }
  }

  return grouped;
}

function attachLiquidacionEstadoFinanciero(liquidacion, movimientos = []) {
  return {
    ...liquidacion,
    ...getLiquidacionEstadoFinanciero({ liquidacion, movimientos }),
  };
}

function formatConductorNombre(conductor) {
  if (!conductor) return "Sin conductor";
  const nombre = [conductor.nombre, conductor.apPaterno, conductor.apMaterno].filter(Boolean).join(" ").trim();
  return nombre || "Sin conductor";
}

function computeConductorSettlementSummary(liquidaciones = []) {
  const byConductor = new Map();

  for (const liquidacion of liquidaciones) {
    const conductorId = liquidacion.conductorId ?? liquidacion.conductor?.id ?? "SIN_CONDUCTOR";
    const summary = byConductor.get(conductorId) ?? {
      conductorId,
      conductorNombre: formatConductorNombre(liquidacion.conductor),
      cantidadLiquidaciones: 0,
      sinSaldo: 0,
      pendientesRegularizar: 0,
      parcialmenteCompensadas: 0,
      compensadas: 0,
      totalFavorEmpresaPendiente: 0,
      totalFavorConductorPendiente: 0,
      deudaNetaPendiente: 0,
    };

    summary.cantidadLiquidaciones += 1;

    const saldoPendiente = toMoney(liquidacion.saldoPendiente);
    if (saldoPendiente > 0) {
      summary.totalFavorEmpresaPendiente += saldoPendiente;
    } else if (saldoPendiente < 0) {
      summary.totalFavorConductorPendiente += Math.abs(saldoPendiente);
    }
    summary.deudaNetaPendiente += saldoPendiente;

    switch (liquidacion.estadoRegularizacion) {
      case "SIN_SALDO":
        summary.sinSaldo += 1;
        break;
      case "PENDIENTE_REGULARIZAR":
        summary.pendientesRegularizar += 1;
        break;
      case "PARCIALMENTE_COMPENSADA":
        summary.parcialmenteCompensadas += 1;
        break;
      case "COMPENSADA":
        summary.compensadas += 1;
        break;
      default:
        break;
    }

    byConductor.set(conductorId, summary);
  }

  return Array.from(byConductor.values()).map((item) => ({
    ...item,
    totalFavorEmpresaPendiente: normalizeZero(roundCurrency(item.totalFavorEmpresaPendiente)),
    totalFavorConductorPendiente: normalizeZero(roundCurrency(item.totalFavorConductorPendiente)),
    deudaNetaPendiente: normalizeZero(roundCurrency(item.deudaNetaPendiente)),
  }));
}

module.exports = {
  EPSILON,
  LIQUIDACION_RESULTADO_ECONOMICO,
  LIQUIDACION_REGULARIZACION_STATUS,
  LIQUIDACION_SALDO_MOVIMIENTO_TIPOS,
  normalizeTipoMovimiento,
  normalizeLiquidacionStatus,
  resolveSaldoFavorTag,
  resolveLiquidacionResultadoEconomico,
  resolveRegularizacionStatus,
  computeMovimientoAplicadoTotal,
  computeLiquidacionSaldoPendiente,
  getLiquidacionEstadoFinanciero,
  groupMovimientosByLiquidacion,
  attachLiquidacionEstadoFinanciero,
  computeConductorSettlementSummary,
  toNumber,
  toMoney,
};
