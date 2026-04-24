const {
  EPSILON,
  LIQUIDACION_SALDO_MOVIMIENTO_TIPOS,
  attachLiquidacionEstadoFinanciero,
  getLiquidacionEstadoFinanciero,
  groupMovimientosByLiquidacion,
  normalizeTipoMovimiento,
  toMoney,
} = require("./settlement");
const logger = require("../../lib/logger");

const liquidacionSaldoMovimientoInclude = {
  conductor: {
    select: {
      id: true,
      nombre: true,
      apPaterno: true,
      apMaterno: true,
      nroDocumento: true,
    },
  },
  liquidacionOrigen: {
    select: {
      id: true,
      conductorId: true,
      saldo: true,
      status: true,
      createdAt: true,
      servicioId: true,
    },
  },
  liquidacionDestino: {
    select: {
      id: true,
      conductorId: true,
      saldo: true,
      status: true,
      createdAt: true,
      servicioId: true,
    },
  },
};

function createDomainError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isMissingSaldoMovimientosTableError(error) {
  if (!error || error.code !== "P2021") return false;
  const detail = `${error.meta?.table ?? ""} ${error.meta?.modelName ?? ""} ${error.message ?? ""}`.toLowerCase();
  return detail.includes("liquidacionsaldomovimiento");
}

function toDateOrNow(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function serializeConductor(conductor) {
  if (!conductor) return null;
  const nombreCompleto = [conductor.nombre, conductor.apPaterno, conductor.apMaterno]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...conductor,
    nombreCompleto: nombreCompleto || conductor.nombre || "Sin conductor",
  };
}

function serializeMovimiento(movimiento, context = {}) {
  const liquidacionIdContext = context.liquidacionId ?? null;
  const tipo = normalizeTipoMovimiento(movimiento?.tipo);

  let rolEnLiquidacion = null;
  if (liquidacionIdContext) {
    if (movimiento.liquidacionOrigenId === liquidacionIdContext) {
      rolEnLiquidacion = "ORIGEN";
    } else if (movimiento.liquidacionDestinoId === liquidacionIdContext) {
      rolEnLiquidacion = "DESTINO";
    }
  }

  return {
    ...movimiento,
    tipo,
    monto: toMoney(movimiento?.monto),
    conductor: serializeConductor(movimiento?.conductor),
    rolEnLiquidacion,
  };
}

function serializeLiquidacionBase(liquidacion) {
  if (!liquidacion) return null;

  return {
    ...liquidacion,
    montoEntregado: toMoney(liquidacion.montoEntregado),
    totalGastos: toMoney(liquidacion.totalGastos),
    saldo: toMoney(liquidacion.saldo),
    conductor: serializeConductor(liquidacion.conductor),
  };
}

async function findMovimientosByLiquidacionIds(db, liquidacionIds = [], options = {}) {
  const ids = Array.isArray(liquidacionIds)
    ? [...new Set(liquidacionIds.filter(Boolean))]
    : [];

  if (ids.length === 0) return [];

  const includeRelations = options.includeRelations === true;
  const direction = options.orderDirection === "desc" ? "desc" : "asc";

  try {
    return await db.liquidacionSaldoMovimiento.findMany({
      where: {
        OR: [
          { liquidacionOrigenId: { in: ids } },
          { liquidacionDestinoId: { in: ids } },
        ],
      },
      include: includeRelations ? liquidacionSaldoMovimientoInclude : undefined,
      orderBy: [{ fechaMovimiento: direction }, { createdAt: direction }],
    });
  } catch (error) {
    if (!isMissingSaldoMovimientosTableError(error)) throw error;

    logger.warn("Tabla LiquidacionSaldoMovimiento no disponible; se omite lectura de movimientos.", {
      code: error.code,
      meta: error.meta ?? null,
    });
    return [];
  }
}

async function findMovimientosForLiquidacion(db, liquidacionId, options = {}) {
  return findMovimientosByLiquidacionIds(db, [liquidacionId], options);
}

async function getLiquidacionWithFinancialState(db, liquidacionId) {
  const liquidacion = await db.liquidacion.findUnique({
    where: { id: liquidacionId },
    select: {
      id: true,
      conductorId: true,
      status: true,
      montoEntregado: true,
      totalGastos: true,
      saldo: true,
      createdAt: true,
    },
  });

  if (!liquidacion) return null;

  const movimientos = await findMovimientosForLiquidacion(db, liquidacionId, {
    includeRelations: false,
    orderDirection: "asc",
  });

  const estado = getLiquidacionEstadoFinanciero({
    liquidacion: serializeLiquidacionBase(liquidacion),
    movimientos,
  });

  return {
    liquidacion,
    movimientos,
    estado,
  };
}

function assertMontoNoExcedePendiente(monto, saldoPendiente, message) {
  const limite = Math.abs(toMoney(saldoPendiente));
  if (monto > limite + EPSILON) {
    throw createDomainError(409, message);
  }
}

function assertMovimientoTipoValido(tipo) {
  if (!LIQUIDACION_SALDO_MOVIMIENTO_TIPOS.includes(tipo)) {
    throw createDomainError(400, "Tipo de movimiento no permitido.");
  }
}

async function createLiquidacionSaldoMovimiento(db, payload) {
  const liquidacionOrigenId = payload.liquidacionOrigenId;
  const liquidacionDestinoId = payload.liquidacionDestinoId ?? null;
  const tipo = normalizeTipoMovimiento(payload.tipo);
  const monto = toMoney(payload.monto);
  const fechaMovimiento = toDateOrNow(payload.fechaMovimiento);
  const observacion = typeof payload.observacion === "string" ? payload.observacion.trim() || null : null;

  assertMovimientoTipoValido(tipo);
  if (!(monto > 0)) {
    throw createDomainError(400, "El monto debe ser mayor a 0.");
  }

  const originSnapshot = await getLiquidacionWithFinancialState(db, liquidacionOrigenId);
  if (!originSnapshot) {
    throw createDomainError(404, "Liquidacion origen no encontrada.");
  }

  const saldoOrigenPendiente = toMoney(originSnapshot.estado.saldoPendiente);
  if (Math.abs(saldoOrigenPendiente) < EPSILON) {
    throw createDomainError(409, "La liquidacion origen ya no tiene saldo pendiente por regularizar.");
  }

  let destinationSnapshot = null;
  let finalDestinationId = null;

  if (tipo === "COMPENSACION_ENTRE_LIQUIDACIONES") {
    if (!liquidacionDestinoId) {
      throw createDomainError(400, "La compensacion requiere liquidacion destino.");
    }

    if (liquidacionDestinoId === liquidacionOrigenId) {
      throw createDomainError(400, "La liquidacion destino debe ser diferente a la liquidacion origen.");
    }

    destinationSnapshot = await getLiquidacionWithFinancialState(db, liquidacionDestinoId);
    if (!destinationSnapshot) {
      throw createDomainError(404, "Liquidacion destino no encontrada.");
    }

    if (originSnapshot.liquidacion.conductorId !== destinationSnapshot.liquidacion.conductorId) {
      throw createDomainError(409, "Solo se permiten compensaciones entre liquidaciones del mismo conductor.");
    }

    const saldoDestinoPendiente = toMoney(destinationSnapshot.estado.saldoPendiente);
    if (Math.abs(saldoDestinoPendiente) < EPSILON) {
      throw createDomainError(409, "La liquidacion destino no tiene saldo pendiente por regularizar.");
    }

    if (Math.sign(saldoOrigenPendiente) === Math.sign(saldoDestinoPendiente)) {
      throw createDomainError(409, "La compensacion requiere saldos pendientes con signos opuestos.");
    }

    const limiteCompensacion = Math.min(Math.abs(saldoOrigenPendiente), Math.abs(saldoDestinoPendiente));
    if (monto > limiteCompensacion + EPSILON) {
      throw createDomainError(409, "El monto excede el saldo disponible para compensacion.");
    }

    finalDestinationId = liquidacionDestinoId;
  } else {
    if (liquidacionDestinoId) {
      throw createDomainError(400, "Este tipo de movimiento no permite liquidacion destino.");
    }

    if (tipo === "DEVOLUCION_A_EMPRESA") {
      if (!(saldoOrigenPendiente > 0)) {
        throw createDomainError(409, "La devolucion a empresa solo aplica cuando el saldo pendiente es a favor de la empresa.");
      }
      assertMontoNoExcedePendiente(monto, saldoOrigenPendiente, "El monto excede el saldo pendiente a favor de la empresa.");
    }

    if (tipo === "PAGO_A_CONDUCTOR") {
      if (!(saldoOrigenPendiente < 0)) {
        throw createDomainError(409, "El pago a conductor solo aplica cuando el saldo pendiente es a favor del conductor.");
      }
      assertMontoNoExcedePendiente(monto, saldoOrigenPendiente, "El monto excede el saldo pendiente a favor del conductor.");
    }

    if (tipo === "AJUSTE_MANUAL") {
      assertMontoNoExcedePendiente(
        monto,
        saldoOrigenPendiente,
        "El ajuste manual no puede exceder el saldo pendiente disponible.",
      );
    }
  }

  const created = await db.liquidacionSaldoMovimiento.create({
    data: {
      liquidacionOrigenId,
      liquidacionDestinoId: finalDestinationId,
      conductorId: originSnapshot.liquidacion.conductorId,
      tipo,
      monto,
      fechaMovimiento,
      observacion,
    },
    include: liquidacionSaldoMovimientoInclude,
  });

  const impactedIds = [liquidacionOrigenId];
  if (finalDestinationId) impactedIds.push(finalDestinationId);

  const [liquidacionesImpactadasRaw, movimientosImpactadosRaw] = await Promise.all([
    db.liquidacion.findMany({
      where: { id: { in: impactedIds } },
      select: {
        id: true,
        conductorId: true,
        status: true,
        montoEntregado: true,
        totalGastos: true,
        saldo: true,
        createdAt: true,
        conductor: {
          select: {
            id: true,
            nombre: true,
            apPaterno: true,
            apMaterno: true,
            nroDocumento: true,
          },
        },
      },
    }),
    findMovimientosByLiquidacionIds(db, impactedIds, {
      includeRelations: false,
      orderDirection: "asc",
    }),
  ]);

  const grouped = groupMovimientosByLiquidacion(movimientosImpactadosRaw);
  const liquidacionesImpactadas = liquidacionesImpactadasRaw
    .map((liquidacion) => {
      const serialized = serializeLiquidacionBase(liquidacion);
      return attachLiquidacionEstadoFinanciero(serialized, grouped.get(liquidacion.id) ?? []);
    })
    .sort((a, b) => impactedIds.indexOf(a.id) - impactedIds.indexOf(b.id));

  return {
    movimiento: created,
    liquidacionesImpactadas,
  };
}

module.exports = {
  LIQUIDACION_SALDO_MOVIMIENTO_TIPOS,
  liquidacionSaldoMovimientoInclude,
  serializeMovimiento,
  serializeLiquidacionBase,
  findMovimientosByLiquidacionIds,
  findMovimientosForLiquidacion,
  createLiquidacionSaldoMovimiento,
};
