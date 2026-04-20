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
  createConductorSchema,
  updateConductorSchema,
  TIPOS_DOCUMENTO,
  TIPOS_CONDUCTOR,
  validateDocumentoConductor,
} = require("../validators/conductores.schema");
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

const conductorBuscarQuerySchema = z.object({
  texto: stringQueryField("texto", { max: 80 }),
  soloPropio: booleanQueryField("soloPropio"),
  incluirInactivos: booleanQueryField("incluirInactivos"),
}).strict();

const conductorListQuerySchema = paginationQuerySchema.extend({
  texto: stringQueryField("texto", { max: 80 }),
  activo: booleanQueryField("activo"),
  tipo: enumQueryField(TIPOS_CONDUCTOR, "tipo"),
  tipoDocumento: enumQueryField(TIPOS_DOCUMENTO, "tipoDocumento"),
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

async function conductorTieneServiciosAbiertos(conductorId) {
  const servicioAbierto = await prisma.servicio.findFirst({
    where: {
      conductorId,
      estado: { in: ["PROGRAMADO", "EN_TRANSITO"] },
    },
    select: { id: true },
  });

  return Boolean(servicioAbierto);
}

router.get("/buscar", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: conductorBuscarQuerySchema }, req, res);
    if (!validated) return;

    const { texto, soloPropio, incluirInactivos } = validated.query;
    if (!texto || texto.length < 1) return res.json([]);

    const conductores = await prisma.conductor.findMany({
      where: {
        ...(!incluirInactivos && { activo: true }),
        ...(soloPropio && { propietarioSubcontratadoId: null, tipo: "PROPIO" }),
        OR: [
          { nombre: { contains: texto, mode: "insensitive" } },
          { apPaterno: { contains: texto, mode: "insensitive" } },
          { apMaterno: { contains: texto, mode: "insensitive" } },
          { nroDocumento: { contains: texto } },
          { licencia: { contains: texto, mode: "insensitive" } },
        ],
      },
      include: { propietarioSubcontratado: true },
      take: 10,
      orderBy: [{ apPaterno: "asc" }, { nombre: "asc" }],
    });

    res.json(conductores);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: conductorListQuerySchema }, req, res);
    if (!validated) return;

    const { texto, activo, tipo, tipoDocumento, soloPropio } = validated.query;
    const pagination = resolvePagination(validated.query, { defaultLimit: 100, maxLimit: 100 });

    const where = {
      ...(tipo && { tipo }),
      ...(tipoDocumento && { tipoDocumento }),
      ...(typeof activo === "boolean" && { activo }),
      ...(soloPropio && { propietarioSubcontratadoId: null, tipo: "PROPIO" }),
      ...(texto && {
        OR: [
          { nombre: { contains: texto, mode: "insensitive" } },
          { apPaterno: { contains: texto, mode: "insensitive" } },
          { apMaterno: { contains: texto, mode: "insensitive" } },
          { nroDocumento: { contains: texto } },
          { licencia: { contains: texto, mode: "insensitive" } },
          { propietarioSubcontratado: { is: { razonSocial: { contains: texto, mode: "insensitive" } } } },
        ],
      }),
    };

    const [total, conductores] = await Promise.all([
      prisma.conductor.count({ where }),
      prisma.conductor.findMany({
        where,
        include: {
          propietarioSubcontratado: true,
          _count: { select: { servicios: true, liquidaciones: true } },
        },
        orderBy: [{ apPaterno: "asc" }, { nombre: "asc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    applyPaginationHeaders(res, { ...pagination, total });
    res.json(conductores);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const conductorId = validated.params.id;
    const [conductor, serviciosRecientes, liquidacionesRecientes] = await Promise.all([
      prisma.conductor.findUnique({
        where: { id: conductorId },
        include: {
          propietarioSubcontratado: true,
          _count: { select: { servicios: true, liquidaciones: true } },
        },
      }),
      prisma.servicio.findMany({
        where: { conductorId },
        orderBy: { fechaServicio: "desc" },
        take: 5,
        include: {
          vehiculo: true,
          clientes: { include: { cliente: true } },
        },
      }),
      prisma.liquidacion.findMany({
        where: { conductorId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    if (!conductor) {
      return res.status(404).json({ error: "Conductor no encontrado." });
    }

    res.json({
      ...conductor,
      serviciosRecientes: serializeServiciosEstado(serviciosRecientes),
      liquidacionesRecientes,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = validate(createConductorSchema, req.body, res);
    if (!body) return;

    const duplicado = await prisma.conductor.findFirst({
      where: { nroDocumento: body.nroDocumento },
    });

    if (duplicado) {
      return res.status(409).json({
        error: "Ya existe un conductor registrado con ese numero de documento.",
        detalles: [{ campo: "nroDocumento", mensaje: "Ya existe un conductor registrado con ese numero de documento." }],
      });
    }

    const propietario = body.propietario ? await upsertPropietario(body.propietario) : null;

    const conductor = await prisma.conductor.create({
      data: {
        nombre: body.nombre,
        apPaterno: body.apPaterno,
        apMaterno: body.apMaterno ?? null,
        tipoDocumento: body.tipoDocumento,
        nroDocumento: body.nroDocumento,
        licencia: body.licencia ?? null,
        tipo: body.tipo,
        activo: body.activo ?? true,
        propietarioSubcontratadoId: propietario?.id ?? null,
      },
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, liquidaciones: true } },
      },
    });

    req.log.info("Conductor creado", { conductorId: conductor.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Conductor",
      entityId: conductor.id,
      action: "create",
      req,
      metadata: { tipo: conductor.tipo, nroDocumento: conductor.nroDocumento },
    });
    res.status(201).json(conductor);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(updateConductorSchema, req.body, res);
    if (!body) return;

    const actual = await prisma.conductor.findUnique({
      where: { id: validated.params.id },
      include: { propietarioSubcontratado: true },
    });

    if (!actual) {
      return res.status(404).json({ error: "Conductor no encontrado." });
    }

    if (body.tipoDocumento !== undefined || body.nroDocumento !== undefined) {
      const tipoDocumentoFinal = body.tipoDocumento ?? actual.tipoDocumento;
      const nroDocumentoFinal = body.nroDocumento ?? actual.nroDocumento;
      const documentoError = validateDocumentoConductor(tipoDocumentoFinal, nroDocumentoFinal);
      if (documentoError) {
        return res.status(400).json({
          error: documentoError,
          detalles: [{ campo: "nroDocumento", mensaje: documentoError }],
        });
      }
    }

    if (body.nroDocumento && body.nroDocumento !== actual.nroDocumento) {
      const duplicado = await prisma.conductor.findFirst({
        where: { nroDocumento: body.nroDocumento },
      });
      if (duplicado && duplicado.id !== actual.id) {
        return res.status(409).json({
          error: "Ya existe otro conductor registrado con ese numero de documento.",
          detalles: [{ campo: "nroDocumento", mensaje: "Ya existe otro conductor registrado con ese numero de documento." }],
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
        error: "Debes indicar la empresa propietaria para un conductor subcontratado.",
      });
    }

    if (body.activo === false && actual.activo !== false) {
      const tieneServiciosAbiertos = await conductorTieneServiciosAbiertos(actual.id);
      if (tieneServiciosAbiertos) {
        return res.status(409).json({
          error: "No se puede desactivar el conductor porque tiene servicios abiertos asociados.",
        });
      }
    }

    const conductor = await prisma.conductor.update({
      where: { id: actual.id },
      data: {
        ...(body.nombre !== undefined && { nombre: body.nombre }),
        ...(body.apPaterno !== undefined && { apPaterno: body.apPaterno }),
        ...(body.apMaterno !== undefined && { apMaterno: body.apMaterno }),
        ...(body.tipoDocumento !== undefined && { tipoDocumento: body.tipoDocumento }),
        ...(body.nroDocumento !== undefined && { nroDocumento: body.nroDocumento }),
        ...(body.licencia !== undefined && { licencia: body.licencia }),
        ...(body.tipo !== undefined && { tipo: body.tipo }),
        ...(body.activo !== undefined && { activo: body.activo }),
        propietarioSubcontratadoId,
      },
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, liquidaciones: true } },
      },
    });

    const action = body.activo === false && actual.activo !== false ? "deactivate" : "update";
    req.log.info("Conductor actualizado", { conductorId: actual.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Conductor",
      entityId: conductor.id,
      action,
      req,
      metadata: { campos: Object.keys(body), activoAnterior: actual.activo, activoNuevo: conductor.activo },
    });
    res.json(conductor);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const conductor = await prisma.conductor.findUnique({
      where: { id: validated.params.id },
      include: {
        servicios: {
          where: { estado: { in: ["PROGRAMADO", "EN_TRANSITO"] } },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!conductor) {
      return res.status(404).json({ error: "Conductor no encontrado." });
    }

    if (conductor.servicios.length > 0) {
      return res.status(409).json({
        error: "No se puede desactivar el conductor porque tiene servicios abiertos asociados.",
      });
    }

    if (!conductor.activo) {
      return res.json({
        ok: true,
        message: "El conductor ya se encuentra inactivo.",
        conductor,
      });
    }

    const actualizado = await prisma.conductor.update({
      where: { id: conductor.id },
      data: { activo: false },
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, liquidaciones: true } },
      },
    });

    req.log.info("Conductor desactivado", { conductorId: conductor.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Conductor",
      entityId: conductor.id,
      action: "deactivate",
      req,
      metadata: { nroDocumento: conductor.nroDocumento },
    });
    res.json({ ok: true, message: "Conductor desactivado correctamente.", conductor: actualizado });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
