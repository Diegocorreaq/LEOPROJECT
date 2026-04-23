const express = require("express");
const { z } = require("zod");
const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireAdmin, requireOperaciones } = require("../middleware/rbac");
const { recordAuditEvent } = require("../lib/audit");
const { placasCoinciden } = require("../lib/normalizePlaca");
const { normalizeEstadoServicio, serializeServicioEstado } = require("../lib/servicioEstado");
const { applyPaginationHeaders, resolvePagination } = require("../lib/pagination");
const { validate, validateRequest } = require("../lib/validate");
const {
  LIQUIDACION_STATUS,
  createLiquidacionSaldoMovimientoSchema,
  createLiquidacionSchema,
  patchLiquidacionStatusSchema,
  updateLiquidacionSchema,
} = require("../validators/liquidaciones.schema");
const { COMPONENTES_KM } = require("../validators/flota.schema");
const { computeLiquidacion } = require("../modules/liquidaciones/computeLiquidacion");
const { getLiquidacionEstadoFinanciero, groupMovimientosByLiquidacion } = require("../modules/liquidaciones/settlement");
const {
  createLiquidacionSaldoMovimiento,
  findMovimientosByLiquidacionIds,
  findMovimientosForLiquidacion,
  serializeMovimiento,
} = require("../modules/liquidaciones/saldoMovimientos");
const {
  booleanQueryField,
  enumQueryField,
  idParamSchema,
  isoDateQueryField,
  paginationQuerySchema,
  stringQueryField,
  uuidQueryField,
} = require("../validators/common.schema");

const router = express.Router();

router.use(authMiddleware);
router.use(requireOperaciones);

const liquidacionListQuerySchema = paginationQuerySchema.extend({
  texto: stringQueryField("texto", { max: 120 }),
  status: enumQueryField(LIQUIDACION_STATUS, "status"),
  conductorId: uuidQueryField("conductorId"),
  servicioId: uuidQueryField("servicioId"),
  pendientes: booleanQueryField("pendientes"),
  mes: z.preprocess((value) => (value === undefined ? undefined : value), z.coerce.number().int().min(1).max(12).optional()),
  anio: z.preprocess((value) => (value === undefined ? undefined : value), z.coerce.number().int().min(2020).max(2100).optional()),
  desde: isoDateQueryField("desde"),
  hasta: isoDateQueryField("hasta"),
  favor: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z.enum(["EMPRESA", "CONDUCTOR"]).optional(),
  ),
}).strict();

const serviciosDisponiblesQuerySchema = z.object({
  texto: stringQueryField("texto", { max: 120 }),
  liquidacionId: uuidQueryField("liquidacionId"),
  limit: z.preprocess((value) => (value === undefined ? 25 : value), z.coerce.number().int().min(1).max(50)),
}).strict();

const liquidacionInclude = {
  conductor: true,
  servicio: {
    include: {
      vehiculo: true,
      conductor: true,
      clientes: { include: { cliente: true } },
      guias: {
        orderBy: [{ fechaEmision: "desc" }, { createdAt: "desc" }],
      },
    },
  },
};

const servicioDisponibleInclude = {
  vehiculo: true,
  conductor: true,
  clientes: { include: { cliente: true } },
  guias: {
    orderBy: [{ fechaEmision: "desc" }, { createdAt: "desc" }],
  },
  liquidacion: {
    select: { id: true, status: true },
  },
};

function toNumber(value) {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatConductorNombre(conductor) {
  if (!conductor) return null;
  return [conductor.nombre, conductor.apPaterno, conductor.apMaterno].filter(Boolean).join(" ");
}

function getClienteReferencia(servicio) {
  if (!servicio) return null;

  const guiaPagador = (servicio.guias ?? []).find((guia) => guia.pagadorFleteNombre?.trim());
  if (guiaPagador?.pagadorFleteNombre) return guiaPagador.pagadorFleteNombre;

  return servicio.clientes?.[0]?.cliente?.razonSocial ?? null;
}

function serializeServicio(servicio) {
  if (!servicio) return null;

  return {
    ...serializeServicioEstado(servicio),
    conductorNombre: formatConductorNombre(servicio.conductor),
    clienteReferencia: getClienteReferencia(servicio),
  };
}

function serializeLiquidacion(liquidacion, movimientos = []) {
  if (!liquidacion) return null;

  const serialized = {
    ...liquidacion,
    montoEntregado: toNumber(liquidacion.montoEntregado),
    viaticos: toNumber(liquidacion.viaticos),
    peajes: toNumber(liquidacion.peajes),
    combustible: toNumber(liquidacion.combustible),
    galones: toNumber(liquidacion.galones),
    kmInicial: liquidacion.kmInicial != null ? toNumber(liquidacion.kmInicial) : null,
    kmFinal: liquidacion.kmFinal != null ? toNumber(liquidacion.kmFinal) : null,
    otros: toNumber(liquidacion.otros),
    totalGastos: toNumber(liquidacion.totalGastos),
    saldo: toNumber(liquidacion.saldo),
    conductor: liquidacion.conductor
      ? {
          ...liquidacion.conductor,
          nombreCompleto: formatConductorNombre(liquidacion.conductor),
        }
      : null,
    servicio: serializeServicio(liquidacion.servicio),
  };

  const settlement = getLiquidacionEstadoFinanciero({
    liquidacion: serialized,
    movimientos,
  });

  return {
    ...serialized,
    ...settlement,
  };
}

function buildDateRange({ mes, anio, desde, hasta }) {
  if (desde || hasta) {
    return {
      ...(desde && { gte: new Date(desde) }),
      ...(hasta && { lte: new Date(hasta) }),
    };
  }

  if (!mes && !anio) return null;

  const year = Number(anio) || new Date().getFullYear();
  const month = Number(mes);

  if (!Number.isInteger(month) || month < 1 || month > 12) return null;

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { gte: start, lte: end };
}

function buildTextoWhere(texto) {
  if (!texto?.trim()) return null;

  const query = texto.trim();
  return {
    OR: [
      { detalleSaldo: { contains: query, mode: "insensitive" } },
      { status: { contains: query, mode: "insensitive" } },
      {
        servicio: {
          is: {
            OR: [
              { origen: { contains: query, mode: "insensitive" } },
              { destino: { contains: query, mode: "insensitive" } },
              { vehiculo: { is: { placa: { contains: query, mode: "insensitive" } } } },
              { conductor: { is: { nombre: { contains: query, mode: "insensitive" } } } },
              { conductor: { is: { apPaterno: { contains: query, mode: "insensitive" } } } },
              { clientes: { some: { cliente: { razonSocial: { contains: query, mode: "insensitive" } } } } },
              { guias: { some: { pagadorFleteNombre: { contains: query, mode: "insensitive" } } } },
              { guias: { some: { pagadorFleteRuc: { contains: query } } } },
            ],
          },
        },
      },
    ],
  };
}

async function getServicioElegible(db, servicioId, currentLiquidacionId = null) {
  const servicio = await db.servicio.findUnique({
    where: { id: servicioId },
    include: servicioDisponibleInclude,
  });

  if (!servicio) {
    return { error: "Servicio no encontrado.", status: 404 };
  }

  if (servicio.liquidacion && servicio.liquidacion.id !== currentLiquidacionId) {
    return {
      error: "El servicio seleccionado ya tiene una liquidacion registrada.",
      status: 409,
    };
  }

  return { servicio };
}

function buildLiquidacionData(body, servicio) {
  const computed = computeLiquidacion(body);

  return {
    servicioId: servicio.id,
    conductorId: servicio.conductorId,
    montoEntregado: computed.montoEntregado,
    viaticos: computed.viaticos,
    peajes: computed.peajes,
    combustible: computed.combustible,
    galones: computed.galones,
    kmInicial: body.kmInicial ?? null,
    kmFinal: body.kmFinal ?? null,
    otros: computed.otros,
    totalGastos: computed.totalGastos,
    saldo: computed.saldo,
    detalleSaldo: computed.detalleSaldo,
    status: computed.status,
    observaciones: body.observaciones ?? null,
  };
}

function calcularKmRecorridos(kmInicial, kmFinal) {
  const ini = kmInicial != null ? Number(kmInicial) : null;
  const fin = kmFinal != null ? Number(kmFinal) : null;
  if (ini === null || fin === null) return 0;
  return Math.max(0, fin - ini);
}

async function acumularKmVehiculo(tx, vehiculoId, deltaKm) {
  if (deltaKm === 0) return;
  for (const componente of COMPONENTES_KM) {
    const current = await tx.mantenimientoKm.findUnique({
      where: { vehiculoId_componente: { vehiculoId, componente } },
      select: { kmAcumulado: true },
    });
    const kmActual = Number(current?.kmAcumulado ?? 0);
    const nuevoKm = Math.max(0, kmActual + deltaKm);
    await tx.mantenimientoKm.upsert({
      where: { vehiculoId_componente: { vehiculoId, componente } },
      create: { vehiculoId, componente, kmAcumulado: nuevoKm, kmPermitido: 0, rendimientoEstandar: 0 },
      update: { kmAcumulado: nuevoKm },
    });
  }
}

async function getLiquidacionDetalle(db, liquidacionId) {
  const [liquidacion, movimientos] = await Promise.all([
    db.liquidacion.findUnique({
      where: { id: liquidacionId },
      include: liquidacionInclude,
    }),
    findMovimientosForLiquidacion(db, liquidacionId, { includeRelations: false, orderDirection: "asc" }),
  ]);

  return liquidacion ? serializeLiquidacion(liquidacion, movimientos) : null;
}

async function mapLiquidacionesWithFinancialState(db, liquidaciones) {
  const liquidacionIds = liquidaciones.map((item) => item.id).filter(Boolean);
  const movimientos = await findMovimientosByLiquidacionIds(db, liquidacionIds, {
    includeRelations: false,
    orderDirection: "asc",
  });
  const grouped = groupMovimientosByLiquidacion(movimientos);

  return liquidaciones.map((liquidacion) => serializeLiquidacion(liquidacion, grouped.get(liquidacion.id) ?? []));
}

function scoreServicio(servicio, referencia) {
  if (!referencia) return { score: 0, razones: [] };

  let score = 0;
  const razones = [];

  if (placasCoinciden(referencia.vehiculo?.placa, servicio.vehiculo?.placa)) {
    score += 35;
    razones.push("Misma placa");
  }

  if (referencia.conductorId && referencia.conductorId === servicio.conductorId) {
    score += 30;
    razones.push("Mismo conductor");
  }

  if (referencia.fechaServicio && servicio.fechaServicio) {
    const diffDays =
      Math.abs(new Date(referencia.fechaServicio).getTime() - new Date(servicio.fechaServicio).getTime()) /
      (1000 * 60 * 60 * 24);

    if (diffDays < 1) {
      score += 20;
      razones.push("Misma fecha");
    } else if (diffDays <= 3) {
      score += 10;
      razones.push("Fecha cercana");
    }
  }

  const origenBase = (referencia.origen ?? "").toLowerCase();
  const destinoBase = (referencia.destino ?? "").toLowerCase();
  const origenActual = (servicio.origen ?? "").toLowerCase();
  const destinoActual = (servicio.destino ?? "").toLowerCase();

  if (
    origenBase &&
    origenActual &&
    (origenBase.includes(origenActual) || origenActual.includes(origenBase))
  ) {
    score += 8;
    razones.push("Origen similar");
  }

  if (
    destinoBase &&
    destinoActual &&
    (destinoBase.includes(destinoActual) || destinoActual.includes(destinoBase))
  ) {
    score += 8;
    razones.push("Destino similar");
  }

  const clientesBase = new Set(
    (referencia.clientes ?? [])
      .map((item) => item.cliente?.id ?? item.clienteId ?? null)
      .filter(Boolean),
  );
  const clientesActuales = (servicio.clientes ?? [])
    .map((item) => item.cliente?.id ?? item.clienteId ?? null)
    .filter(Boolean);

  if (clientesActuales.some((clienteId) => clientesBase.has(clienteId))) {
    score += 15;
    razones.push("Cliente relacionado");
  }

  const pagadoresBase = new Set(
    (referencia.guias ?? [])
      .map((guia) => guia.pagadorFleteRuc ?? guia.pagadorFleteNombre ?? null)
      .filter(Boolean),
  );
  const pagadoresActuales = (servicio.guias ?? [])
    .map((guia) => guia.pagadorFleteRuc ?? guia.pagadorFleteNombre ?? null)
    .filter(Boolean);

  if (pagadoresActuales.some((pagador) => pagadoresBase.has(pagador))) {
    score += 12;
    razones.push("Pagador relacionado");
  }

  return { score, razones };
}

router.get("/", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: liquidacionListQuerySchema }, req, res);
    if (!validated) return;

    const { texto, status, conductorId, servicioId, pendientes, favor, mes, anio, desde, hasta } = validated.query;
    const pagination = resolvePagination(validated.query, { defaultLimit: 100, maxLimit: 100 });
    const andConditions = [];

    if (status) andConditions.push({ status });
    if (conductorId) andConditions.push({ conductorId });
    if (servicioId) andConditions.push({ servicioId });

    if (pendientes) {
      andConditions.push({ status: "PENDIENTE" });
    }

    if (favor === "EMPRESA") {
      andConditions.push({ saldo: { gt: 0 } });
    } else if (favor === "CONDUCTOR") {
      andConditions.push({ saldo: { lt: 0 } });
    }

    const dateRange = buildDateRange({ mes, anio, desde, hasta });
    if (dateRange) {
      andConditions.push({
        servicio: {
          is: {
            fechaServicio: dateRange,
          },
        },
      });
    }

    const textWhere = buildTextoWhere(texto);
    if (textWhere) andConditions.push(textWhere);

    const where = andConditions.length > 0 ? { AND: andConditions } : undefined;

    const [total, liquidaciones] = await Promise.all([
      prisma.liquidacion.count({ where }),
      prisma.liquidacion.findMany({
        where,
        include: liquidacionInclude,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);
    const liquidacionesConEstado = await mapLiquidacionesWithFinancialState(prisma, liquidaciones);

    applyPaginationHeaders(res, { ...pagination, total });
    res.json(
      liquidacionesConEstado
        .sort(
          (a, b) =>
            new Date(b.servicio?.fechaServicio ?? b.createdAt).getTime() -
            new Date(a.servicio?.fechaServicio ?? a.createdAt).getTime(),
        ),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/servicios-disponibles", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: serviciosDisponiblesQuerySchema }, req, res);
    if (!validated) return;

    const texto = validated.query.texto ?? "";
    const liquidacionId = validated.query.liquidacionId ?? null;
    const limit = validated.query.limit;

    let referencia = null;
    let servicioActualId = null;

    if (liquidacionId) {
      const liquidacion = await prisma.liquidacion.findUnique({
        where: { id: liquidacionId },
        include: {
          servicio: {
            include: servicioDisponibleInclude,
          },
        },
      });

      referencia = liquidacion?.servicio ?? null;
      servicioActualId = liquidacion?.servicioId ?? null;
    }

    const andConditions = [
      {
        OR: [
          { liquidacion: { is: null } },
          ...(servicioActualId ? [{ id: servicioActualId }] : []),
        ],
      },
    ];

    if (texto) {
      andConditions.push({
        OR: [
          { id: { contains: texto, mode: "insensitive" } },
          { origen: { contains: texto, mode: "insensitive" } },
          { destino: { contains: texto, mode: "insensitive" } },
          { vehiculo: { is: { placa: { contains: texto, mode: "insensitive" } } } },
          { conductor: { is: { nombre: { contains: texto, mode: "insensitive" } } } },
          { conductor: { is: { apPaterno: { contains: texto, mode: "insensitive" } } } },
          { clientes: { some: { cliente: { razonSocial: { contains: texto, mode: "insensitive" } } } } },
          { guias: { some: { pagadorFleteNombre: { contains: texto, mode: "insensitive" } } } },
        ],
      });
    }

    const servicios = await prisma.servicio.findMany({
      where: { AND: andConditions },
      include: servicioDisponibleInclude,
      orderBy: { fechaServicio: "desc" },
      take: texto ? 50 : limit,
    });

    const result = servicios
      .map((servicio) => {
        const { score, razones } = scoreServicio(servicio, referencia);
        return {
          id: servicio.id,
          fechaServicio: servicio.fechaServicio,
          origen: servicio.origen,
          destino: servicio.destino,
          estado: normalizeEstadoServicio(servicio.estado),
          conductorId: servicio.conductorId,
          conductor: servicio.conductor
            ? {
                id: servicio.conductor.id,
                nombre: servicio.conductor.nombre,
                apPaterno: servicio.conductor.apPaterno,
                apMaterno: servicio.conductor.apMaterno,
                nombreCompleto: formatConductorNombre(servicio.conductor),
                nroDocumento: servicio.conductor.nroDocumento,
              }
            : null,
          vehiculo: servicio.vehiculo
            ? {
                id: servicio.vehiculo.id,
                placa: servicio.vehiculo.placa,
                placaCarreta: servicio.vehiculo.placaCarreta,
                tipoUnidad: servicio.vehiculo.tipoUnidad,
              }
            : null,
          clientes: (servicio.clientes ?? []).map((item) => ({
            id: item.cliente.id,
            razonSocial: item.cliente.razonSocial,
            ruc: item.cliente.ruc,
          })),
          guias: (servicio.guias ?? []).map((guia) => ({
            id: guia.id,
            serie: guia.serie,
            numero: guia.numero,
            pagadorFleteNombre: guia.pagadorFleteNombre,
            pagadorFleteRuc: guia.pagadorFleteRuc,
          })),
          clienteReferencia: getClienteReferencia(servicio),
          score,
          razones,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.fechaServicio).getTime() - new Date(a.fechaServicio).getTime();
      })
      .slice(0, limit);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const liquidacion = await getLiquidacionDetalle(prisma, validated.params.id);

    if (!liquidacion) {
      return res.status(404).json({ error: "Liquidacion no encontrada." });
    }

    res.json(liquidacion);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/movimientos-saldo", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const liquidacionId = validated.params.id;
    const [liquidacionRaw, movimientos] = await Promise.all([
      prisma.liquidacion.findUnique({
        where: { id: liquidacionId },
        include: liquidacionInclude,
      }),
      findMovimientosForLiquidacion(prisma, liquidacionId, {
        includeRelations: true,
        orderDirection: "asc",
      }),
    ]);

    if (!liquidacionRaw) {
      return res.status(404).json({ error: "Liquidacion no encontrada." });
    }

    const liquidacion = serializeLiquidacion(liquidacionRaw, movimientos);

    res.json({
      liquidacionId,
      estadoRendicion: liquidacion.estadoRendicion,
      resultadoEconomico: liquidacion.resultadoEconomico,
      estadoRegularizacion: liquidacion.estadoRegularizacion,
      saldoBase: liquidacion.saldoBase,
      saldoPendiente: liquidacion.saldoPendiente,
      montoRegularizado: liquidacion.montoRegularizado,
      montoPendienteAbsoluto: liquidacion.montoPendienteAbsoluto,
      movimientos: movimientos.map((movimiento) =>
        serializeMovimiento(movimiento, { liquidacionId: liquidacionId }),
      ),
      liquidacion,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/movimientos-saldo", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(createLiquidacionSaldoMovimientoSchema, req.body, res);
    if (!body) return;

    const result = await prisma.$transaction(
      async (tx) =>
        createLiquidacionSaldoMovimiento(tx, {
          liquidacionOrigenId: validated.params.id,
          ...body,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    req.log.info("Movimiento de saldo registrado", {
      movimientoId: result.movimiento.id,
      liquidacionOrigenId: result.movimiento.liquidacionOrigenId,
      liquidacionDestinoId: result.movimiento.liquidacionDestinoId,
      tipo: result.movimiento.tipo,
      monto: Number(result.movimiento.monto),
      usuarioId: req.user.id,
    });

    await recordAuditEvent({
      entityType: "LiquidacionSaldoMovimiento",
      entityId: result.movimiento.id,
      action: "create",
      req,
      metadata: {
        liquidacionOrigenId: result.movimiento.liquidacionOrigenId,
        liquidacionDestinoId: result.movimiento.liquidacionDestinoId,
        conductorId: result.movimiento.conductorId,
        tipo: result.movimiento.tipo,
        monto: Number(result.movimiento.monto),
      },
    });

    await Promise.all(
      result.liquidacionesImpactadas.map((liquidacion) =>
        recordAuditEvent({
          entityType: "Liquidacion",
          entityId: liquidacion.id,
          action: "saldo_movement",
          req,
          metadata: {
            movimientoId: result.movimiento.id,
            tipo: result.movimiento.tipo,
            saldoPendiente: liquidacion.saldoPendiente,
            estadoRegularizacion: liquidacion.estadoRegularizacion,
          },
        }),
      ),
    );

    res.status(201).json({
      movimiento: serializeMovimiento(result.movimiento, {
        liquidacionId: validated.params.id,
      }),
      liquidacionesImpactadas: result.liquidacionesImpactadas,
      message: "Movimiento de saldo registrado correctamente",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = validate(createLiquidacionSchema, req.body, res);
    if (!body) return;

    const liquidacion = await prisma.$transaction(async (tx) => {
      const { servicio, error, status } = await getServicioElegible(tx, body.servicioId);
      if (error) {
        const customError = new Error(error);
        customError.status = status;
        throw customError;
      }

      const created = await tx.liquidacion.create({
        data: buildLiquidacionData(body, servicio),
      });

      if (servicio.vehiculo?.tipo === "PROPIO") {
        const kmRecorridos = calcularKmRecorridos(body.kmInicial, body.kmFinal);
        await acumularKmVehiculo(tx, servicio.vehiculoId, kmRecorridos);
      }

      return getLiquidacionDetalle(tx, created.id);
    });

    req.log.info("Liquidacion creada", {
      liquidacionId: liquidacion.id,
      servicioId: liquidacion.servicioId,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "Liquidacion",
      entityId: liquidacion.id,
      action: "create",
      req,
      metadata: { servicioId: liquidacion.servicioId, status: liquidacion.status },
    });

    res.status(201).json({
      ...liquidacion,
      message: "Liquidacion creada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(updateLiquidacionSchema, req.body, res);
    if (!body) return;

    const updatedLiquidacion = await prisma.$transaction(async (tx) => {
      const existing = await tx.liquidacion.findUnique({
        where: { id: validated.params.id },
        include: { servicio: { include: { vehiculo: true } } },
      });

      if (!existing) {
        const notFound = new Error("Liquidacion no encontrada.");
        notFound.status = 404;
        throw notFound;
      }

      const { servicio, error, status } = await getServicioElegible(tx, body.servicioId, existing.id);
      if (error) {
        const customError = new Error(error);
        customError.status = status;
        throw customError;
      }

      if (existing.servicioId && existing.servicioId !== body.servicioId && req.user.rol !== "ADMIN") {
        const forbidden = new Error("Solo un administrador puede reasignar una liquidacion a otro servicio.");
        forbidden.status = 403;
        throw forbidden;
      }

      await tx.liquidacion.update({
        where: { id: existing.id },
        data: buildLiquidacionData(body, servicio),
      });

      // Acumulación de km: calcular delta respecto a los valores anteriores
      const oldVehiculoId = existing.servicio?.vehiculoId ?? null;
      const oldVehiculoTipo = existing.servicio?.vehiculo?.tipo ?? null;
      const newVehiculoId = servicio.vehiculoId;
      const newVehiculoTipo = servicio.vehiculo?.tipo ?? null;
      const servicioReasignado = existing.servicioId !== body.servicioId;

      if (servicioReasignado) {
        // Revertir km del vehículo anterior y aplicar km al nuevo
        if (oldVehiculoId && oldVehiculoTipo === "PROPIO") {
          const oldKm = calcularKmRecorridos(existing.kmInicial, existing.kmFinal);
          await acumularKmVehiculo(tx, oldVehiculoId, -oldKm);
        }
        if (newVehiculoTipo === "PROPIO") {
          const newKm = calcularKmRecorridos(body.kmInicial, body.kmFinal);
          await acumularKmVehiculo(tx, newVehiculoId, newKm);
        }
      } else if (newVehiculoTipo === "PROPIO") {
        const oldKm = calcularKmRecorridos(existing.kmInicial, existing.kmFinal);
        const newKm = calcularKmRecorridos(body.kmInicial, body.kmFinal);
        const deltaKm = newKm - oldKm;
        await acumularKmVehiculo(tx, newVehiculoId, deltaKm);
      }

      return getLiquidacionDetalle(tx, existing.id);
    });

    req.log.info("Liquidacion actualizada", {
      liquidacionId: validated.params.id,
      servicioId: updatedLiquidacion.servicioId,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "Liquidacion",
      entityId: updatedLiquidacion.id,
      action: "update",
      req,
      metadata: { servicioId: updatedLiquidacion.servicioId, campos: Object.keys(body) },
    });

    res.json({
      ...updatedLiquidacion,
      message: "Liquidacion actualizada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(patchLiquidacionStatusSchema, req.body, res);
    if (!body) return;

    const existing = await prisma.liquidacion.findUnique({
      where: { id: validated.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Liquidacion no encontrada." });
    }

    const computed = computeLiquidacion({
      montoEntregado: existing.montoEntregado,
      viaticos: existing.viaticos,
      peajes: existing.peajes,
      combustible: existing.combustible,
      galones: existing.galones,
      otros: existing.otros,
      status: body.status,
    });

    const updated = await prisma.liquidacion.update({
      where: { id: validated.params.id },
      data: {
        status: body.status,
        detalleSaldo: computed.detalleSaldo,
      },
      include: liquidacionInclude,
    });

    req.log.info("Status de liquidacion actualizado", {
      liquidacionId: validated.params.id,
      statusAnterior: existing.status,
      statusNuevo: body.status,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "Liquidacion",
      entityId: updated.id,
      action: "status_change",
      req,
      metadata: { statusAnterior: existing.status, statusNuevo: body.status },
    });
    const movimientos = await findMovimientosForLiquidacion(prisma, updated.id, {
      includeRelations: false,
      orderDirection: "asc",
    });

    res.json({
      ...serializeLiquidacion(updated, movimientos),
      message: "Status actualizado correctamente",
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/desvincular", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const existing = await prisma.liquidacion.findUnique({
      where: { id: validated.params.id },
      select: { id: true, servicioId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Liquidacion no encontrada." });
    }

    if (!existing.servicioId) {
      const currentDetail = await getLiquidacionDetalle(prisma, existing.id);
      return res.json({
        ...currentDetail,
        message: "La liquidacion ya no tiene un servicio vinculado.",
      });
    }

    await prisma.liquidacion.update({
      where: { id: existing.id },
      data: { servicioId: null },
    });

    const updated = await getLiquidacionDetalle(prisma, existing.id);

    req.log.info("Liquidacion desvinculada de servicio", {
      liquidacionId: existing.id,
      servicioIdAnterior: existing.servicioId,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "Liquidacion",
      entityId: existing.id,
      action: "unlink_service",
      req,
      metadata: { servicioIdAnterior: existing.servicioId },
    });

    res.json({
      ...updated,
      message: "Liquidacion desvinculada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const existing = await prisma.liquidacion.findUnique({
      where: { id: validated.params.id },
      select: { id: true, servicioId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Liquidacion no encontrada." });
    }

    const movimientosRelacionados = await prisma.liquidacionSaldoMovimiento.count({
      where: {
        OR: [{ liquidacionOrigenId: validated.params.id }, { liquidacionDestinoId: validated.params.id }],
      },
    });

    if (movimientosRelacionados > 0) {
      return res.status(409).json({
        error: "No se puede eliminar la liquidacion porque tiene movimientos de saldo asociados.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.liquidacionComprobante.deleteMany({
        where: { liquidacionId: validated.params.id },
      });

      await tx.liquidacion.delete({
        where: { id: validated.params.id },
      });
    });

    req.log.info("Liquidacion eliminada", {
      liquidacionId: validated.params.id,
      servicioId: existing.servicioId,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "Liquidacion",
      entityId: existing.id,
      action: "delete",
      req,
      metadata: { servicioId: existing.servicioId },
    });

    res.json({
      ok: true,
      id: validated.params.id,
      message: "Liquidacion eliminada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
