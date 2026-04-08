const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const logger = require("../lib/logger");
const { validate } = require("../lib/validate");
const {
  createLiquidacionSchema,
  patchLiquidacionStatusSchema,
  updateLiquidacionSchema,
} = require("../validators/liquidaciones.schema");
const { computeLiquidacion } = require("../modules/liquidaciones/computeLiquidacion");

const router = express.Router();

router.use(authMiddleware);
router.use(requireOperaciones);

const liquidacionInclude = {
  comprobantes: {
    orderBy: { createdAt: "asc" },
  },
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
    ...servicio,
    conductorNombre: formatConductorNombre(servicio.conductor),
    clienteReferencia: getClienteReferencia(servicio),
  };
}

function serializeLiquidacion(liquidacion) {
  if (!liquidacion) return null;

  return {
    ...liquidacion,
    montoEntregado: toNumber(liquidacion.montoEntregado),
    viaticos: toNumber(liquidacion.viaticos),
    peajes: toNumber(liquidacion.peajes),
    combustible: toNumber(liquidacion.combustible),
    galones: toNumber(liquidacion.galones),
    otros: toNumber(liquidacion.otros),
    totalGastos: toNumber(liquidacion.totalGastos),
    saldo: toNumber(liquidacion.saldo),
    comprobantesCount: liquidacion.comprobantes?.length ?? 0,
    comprobantes: (liquidacion.comprobantes ?? []).map((comprobante) => ({
      ...comprobante,
      monto: toNumber(comprobante.monto),
    })),
    conductor: liquidacion.conductor
      ? {
          ...liquidacion.conductor,
          nombreCompleto: formatConductorNombre(liquidacion.conductor),
        }
      : null,
    servicio: serializeServicio(liquidacion.servicio),
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
    otros: computed.otros,
    totalGastos: computed.totalGastos,
    saldo: computed.saldo,
    detalleSaldo: computed.detalleSaldo,
    status: computed.status,
    observaciones: body.observaciones ?? null,
  };
}

function buildComprobantesCreate(comprobantes = []) {
  return comprobantes.map((comprobante) => ({
    tipo: comprobante.tipo,
    numero: comprobante.numero ?? null,
    descripcion: comprobante.descripcion ?? null,
    monto: Number(comprobante.monto ?? 0),
    urlArchivo: comprobante.urlArchivo ?? null,
  }));
}

async function getLiquidacionDetalle(db, liquidacionId) {
  const liquidacion = await db.liquidacion.findUnique({
    where: { id: liquidacionId },
    include: liquidacionInclude,
  });

  return liquidacion ? serializeLiquidacion(liquidacion) : null;
}

function scoreServicio(servicio, referencia) {
  if (!referencia) return { score: 0, razones: [] };

  let score = 0;
  const razones = [];

  if (
    referencia.vehiculo?.placa &&
    servicio.vehiculo?.placa &&
    referencia.vehiculo.placa.toUpperCase() === servicio.vehiculo.placa.toUpperCase()
  ) {
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
    const { texto, status, conductorId, servicioId, pendientes, favor, mes, anio, desde, hasta } = req.query;
    const andConditions = [];

    if (status) andConditions.push({ status });
    if (conductorId) andConditions.push({ conductorId });
    if (servicioId) andConditions.push({ servicioId });

    if (pendientes === "true") {
      andConditions.push({ status: { in: ["PENDIENTE", "OBSERVADA"] } });
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

    const liquidaciones = await prisma.liquidacion.findMany({
      where,
      include: liquidacionInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json(
      liquidaciones
        .map(serializeLiquidacion)
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
    const texto = req.query.texto?.trim() ?? "";
    const liquidacionId = req.query.liquidacionId?.trim() || null;
    const limit = Math.min(Number(req.query.limit) || 25, 50);

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
          estado: servicio.estado,
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
    const liquidacion = await getLiquidacionDetalle(prisma, req.params.id);

    if (!liquidacion) {
      return res.status(404).json({ error: "Liquidacion no encontrada." });
    }

    res.json(liquidacion);
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
        data: {
          ...buildLiquidacionData(body, servicio),
          comprobantes: body.comprobantes?.length
            ? {
                create: buildComprobantesCreate(body.comprobantes),
              }
            : undefined,
        },
      });

      return getLiquidacionDetalle(tx, created.id);
    });

    logger.info("Liquidacion creada", {
      liquidacionId: liquidacion.id,
      servicioId: liquidacion.servicioId,
      usuarioId: req.user.id,
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
    const body = validate(updateLiquidacionSchema, req.body, res);
    if (!body) return;

    const updatedLiquidacion = await prisma.$transaction(async (tx) => {
      const existing = await tx.liquidacion.findUnique({
        where: { id: req.params.id },
        include: { servicio: true },
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

      await tx.liquidacionComprobante.deleteMany({
        where: { liquidacionId: existing.id },
      });

      await tx.liquidacion.update({
        where: { id: existing.id },
        data: {
          ...buildLiquidacionData(body, servicio),
          comprobantes: body.comprobantes?.length
            ? {
                create: buildComprobantesCreate(body.comprobantes),
              }
            : undefined,
        },
      });

      return getLiquidacionDetalle(tx, existing.id);
    });

    logger.info("Liquidacion actualizada", {
      liquidacionId: req.params.id,
      servicioId: updatedLiquidacion.servicioId,
      usuarioId: req.user.id,
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
    const body = validate(patchLiquidacionStatusSchema, req.body, res);
    if (!body) return;

    const existing = await prisma.liquidacion.findUnique({
      where: { id: req.params.id },
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
      where: { id: req.params.id },
      data: {
        status: body.status,
        detalleSaldo: computed.detalleSaldo,
      },
      include: liquidacionInclude,
    });

    logger.info("Status de liquidacion actualizado", {
      liquidacionId: req.params.id,
      statusAnterior: existing.status,
      statusNuevo: body.status,
      usuarioId: req.user.id,
    });

    res.json({
      ...serializeLiquidacion(updated),
      message: "Status actualizado correctamente",
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.liquidacion.findUnique({
      where: { id: req.params.id },
      select: { id: true, servicioId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Liquidacion no encontrada." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.liquidacionComprobante.deleteMany({
        where: { liquidacionId: req.params.id },
      });

      await tx.liquidacion.delete({
        where: { id: req.params.id },
      });
    });

    logger.info("Liquidacion eliminada", {
      liquidacionId: req.params.id,
      servicioId: existing.servicioId,
      usuarioId: req.user.id,
    });

    res.json({
      ok: true,
      id: req.params.id,
      message: "Liquidacion eliminada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
