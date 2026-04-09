const { z } = require("zod");
const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireAdmin, requireOperaciones } = require("../middleware/rbac");
const { recordAuditEvent } = require("../lib/audit");
const { serializeServiciosEstado } = require("../lib/servicioEstado");
const { applyPaginationHeaders, resolvePagination } = require("../lib/pagination");
const { validate, validateRequest } = require("../lib/validate");
const {
  createVehiculoSchema,
  updateVehiculoSchema,
  TIPOS_UNIDAD,
  TIPOS_VEHICULO,
  ESTADOS_VEHICULO,
} = require("../validators/vehiculos.schema");
const {
  booleanQueryField,
  enumQueryField,
  idParamSchema,
  paginationQuerySchema,
  stringQueryField,
} = require("../validators/common.schema");

const router = express.Router();

router.use(authMiddleware);
router.use(requireOperaciones);

const vehiculoBuscarQuerySchema = z.object({
  texto: stringQueryField("texto", { max: 60 }),
  tipoUnidad: enumQueryField(TIPOS_UNIDAD, "tipoUnidad"),
  soloPropio: booleanQueryField("soloPropio"),
  incluirInactivos: booleanQueryField("incluirInactivos"),
}).strict();

const vehiculoListQuerySchema = paginationQuerySchema.extend({
  texto: stringQueryField("texto", { max: 80 }),
  tipo: enumQueryField(TIPOS_VEHICULO, "tipo"),
  estado: enumQueryField(ESTADOS_VEHICULO, "estado"),
  soloPropio: booleanQueryField("soloPropio"),
}).strict();

async function upsertPropietario(propietario) {
  if (!propietario) return null;

  return prisma.propietarioSubcontratado.upsert({
    where: { ruc: propietario.ruc },
    update: {
      razonSocial: propietario.razonSocial,
      contacto: propietario.contacto ?? null,
      telefono: propietario.telefono ?? null,
    },
    create: {
      razonSocial: propietario.razonSocial,
      ruc: propietario.ruc,
      contacto: propietario.contacto ?? null,
      telefono: propietario.telefono ?? null,
    },
  });
}

async function vehiculoTieneServiciosAbiertos(vehiculoId) {
  const servicioAbierto = await prisma.servicio.findFirst({
    where: {
      vehiculoId,
      estado: { in: ["PROGRAMADO", "EN_TRANSITO"] },
    },
    select: { id: true },
  });

  return Boolean(servicioAbierto);
}

router.get("/buscar", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: vehiculoBuscarQuerySchema }, req, res);
    if (!validated) return;

    const { texto, tipoUnidad, soloPropio, incluirInactivos } = validated.query;
    if (!texto || texto.length < 1) return res.json([]);

    const vehiculos = await prisma.vehiculo.findMany({
      where: {
        OR: [
          { placa: { contains: texto.toUpperCase(), mode: "insensitive" } },
          { placaCarreta: { contains: texto.toUpperCase(), mode: "insensitive" } },
        ],
        ...(tipoUnidad && { tipoUnidad }),
        ...(!incluirInactivos && { estado: "ACTIVO" }),
        ...(soloPropio && { propietarioSubcontratadoId: null, tipo: "PROPIO" }),
      },
      include: { propietarioSubcontratado: true },
      take: 10,
      orderBy: { placa: "asc" },
    });

    res.json(vehiculos);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: vehiculoListQuerySchema }, req, res);
    if (!validated) return;

    const { texto, tipo, estado, soloPropio } = validated.query;
    const pagination = resolvePagination(validated.query, { defaultLimit: 100, maxLimit: 100 });

    const where = {
      ...(tipo && { tipo }),
      ...(estado && { estado }),
      ...(soloPropio && { propietarioSubcontratadoId: null, tipo: "PROPIO" }),
      ...(texto && {
        OR: [
          { placa: { contains: texto.toUpperCase(), mode: "insensitive" } },
          { placaCarreta: { contains: texto.toUpperCase(), mode: "insensitive" } },
          { mtc: { contains: texto, mode: "insensitive" } },
          { mtcCarreta: { contains: texto, mode: "insensitive" } },
          { propietarioSubcontratado: { is: { razonSocial: { contains: texto, mode: "insensitive" } } } },
        ],
      }),
    };

    const [total, vehiculos] = await Promise.all([
      prisma.vehiculo.count({ where }),
      prisma.vehiculo.findMany({
        where,
        include: {
          propietarioSubcontratado: true,
          _count: { select: { servicios: true, docsVehiculo: true, mantenimientos: true } },
        },
        orderBy: { placa: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    applyPaginationHeaders(res, { ...pagination, total });
    res.json(vehiculos);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const vehiculoId = validated.params.id;
    const [vehiculo, serviciosRecientes] = await Promise.all([
      prisma.vehiculo.findUnique({
        where: { id: vehiculoId },
        include: {
          propietarioSubcontratado: true,
          docsVehiculo: true,
          mantenimientos: true,
          _count: { select: { servicios: true, docsVehiculo: true, mantenimientos: true } },
        },
      }),
      prisma.servicio.findMany({
        where: { vehiculoId },
        orderBy: { fechaServicio: "desc" },
        take: 5,
        include: {
          conductor: true,
          clientes: { include: { cliente: true } },
        },
      }),
    ]);

    if (!vehiculo) {
      return res.status(404).json({ error: "Vehiculo no encontrado." });
    }

    res.json({ ...vehiculo, serviciosRecientes: serializeServiciosEstado(serviciosRecientes) });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = validate(createVehiculoSchema, req.body, res);
    if (!body) return;

    const existente = await prisma.vehiculo.findUnique({ where: { placa: body.placa } });
    if (existente) {
      return res.status(409).json({
        error: "Ya existe un vehiculo registrado con esa placa.",
        detalles: [{ campo: "placa", mensaje: "Ya existe un vehiculo registrado con esa placa." }],
      });
    }

    const propietario = body.propietario ? await upsertPropietario(body.propietario) : null;

    const vehiculo = await prisma.vehiculo.create({
      data: {
        placa: body.placa,
        placaCarreta: body.placaCarreta ?? null,
        tipoUnidad: body.tipoUnidad,
        tipo: body.tipo,
        mtc: body.mtc ?? null,
        mtcCarreta: body.mtcCarreta ?? null,
        pesoNeto: body.pesoNeto ?? null,
        pesoBruto: body.pesoBruto ?? null,
        cargaUtil: body.cargaUtil ?? null,
        estado: body.estado,
        propietarioSubcontratadoId: propietario?.id ?? null,
      },
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, docsVehiculo: true, mantenimientos: true } },
      },
    });

    req.log.info("Vehiculo creado", { vehiculoId: vehiculo.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Vehiculo",
      entityId: vehiculo.id,
      action: "create",
      req,
      metadata: { placa: vehiculo.placa, tipo: vehiculo.tipo },
    });
    res.status(201).json(vehiculo);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(updateVehiculoSchema, req.body, res);
    if (!body) return;

    const actual = await prisma.vehiculo.findUnique({
      where: { id: validated.params.id },
      include: { propietarioSubcontratado: true },
    });

    if (!actual) {
      return res.status(404).json({ error: "Vehiculo no encontrado." });
    }

    if (body.placa && body.placa !== actual.placa) {
      const duplicado = await prisma.vehiculo.findUnique({ where: { placa: body.placa } });
      if (duplicado && duplicado.id !== actual.id) {
        return res.status(409).json({
          error: "Ya existe otro vehiculo registrado con esa placa.",
          detalles: [{ campo: "placa", mensaje: "Ya existe otro vehiculo registrado con esa placa." }],
        });
      }
    }

    const tipoFinal = body.tipo ?? actual.tipo;
    let propietarioSubcontratadoId = actual.propietarioSubcontratadoId;

    if (tipoFinal === "PROPIO") {
      propietarioSubcontratadoId = null;
    } else if (body.propietario) {
      const propietario = await upsertPropietario(body.propietario);
      propietarioSubcontratadoId = propietario.id;
    } else if (!actual.propietarioSubcontratadoId) {
      return res.status(400).json({
        error: "Debes indicar la empresa propietaria para un vehiculo subcontratado.",
      });
    }

    if (body.estado === "INACTIVO" && actual.estado !== "INACTIVO") {
      const tieneServiciosAbiertos = await vehiculoTieneServiciosAbiertos(actual.id);
      if (tieneServiciosAbiertos) {
        return res.status(409).json({
          error: "No se puede desactivar el vehiculo porque tiene servicios abiertos asociados.",
        });
      }
    }

    const vehiculo = await prisma.vehiculo.update({
      where: { id: actual.id },
      data: {
        ...(body.placa !== undefined && { placa: body.placa }),
        ...(body.placaCarreta !== undefined && { placaCarreta: body.placaCarreta }),
        ...(body.tipoUnidad !== undefined && { tipoUnidad: body.tipoUnidad }),
        ...(body.tipo !== undefined && { tipo: body.tipo }),
        ...(body.mtc !== undefined && { mtc: body.mtc }),
        ...(body.mtcCarreta !== undefined && { mtcCarreta: body.mtcCarreta }),
        ...(body.pesoNeto !== undefined && { pesoNeto: body.pesoNeto }),
        ...(body.pesoBruto !== undefined && { pesoBruto: body.pesoBruto }),
        ...(body.cargaUtil !== undefined && { cargaUtil: body.cargaUtil }),
        ...(body.estado !== undefined && { estado: body.estado }),
        propietarioSubcontratadoId,
      },
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, docsVehiculo: true, mantenimientos: true } },
      },
    });

    const action = body.estado === "INACTIVO" && actual.estado !== "INACTIVO" ? "deactivate" : "update";
    req.log.info("Vehiculo actualizado", { vehiculoId: actual.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Vehiculo",
      entityId: vehiculo.id,
      action,
      req,
      metadata: { campos: Object.keys(body), estadoAnterior: actual.estado, estadoNuevo: vehiculo.estado },
    });
    res.json(vehiculo);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: validated.params.id },
      include: {
        servicios: {
          where: { estado: { in: ["PROGRAMADO", "EN_TRANSITO"] } },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!vehiculo) {
      return res.status(404).json({ error: "Vehiculo no encontrado." });
    }

    if (vehiculo.servicios.length > 0) {
      return res.status(409).json({
        error: "No se puede desactivar el vehiculo porque tiene servicios abiertos asociados.",
      });
    }

    if (vehiculo.estado === "INACTIVO") {
      return res.json({
        ok: true,
        message: "El vehiculo ya se encuentra inactivo.",
        vehiculo,
      });
    }

    const actualizado = await prisma.vehiculo.update({
      where: { id: vehiculo.id },
      data: { estado: "INACTIVO" },
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, docsVehiculo: true, mantenimientos: true } },
      },
    });

    req.log.info("Vehiculo desactivado", { vehiculoId: vehiculo.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Vehiculo",
      entityId: vehiculo.id,
      action: "deactivate",
      req,
      metadata: { placa: vehiculo.placa },
    });
    res.json({ ok: true, message: "Vehiculo desactivado correctamente.", vehiculo: actualizado });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
