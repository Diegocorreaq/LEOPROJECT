const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const logger = require("../lib/logger");
const { validate } = require("../lib/validate");
const {
  createConductorSchema,
  updateConductorSchema,
  TIPOS_DOCUMENTO,
  TIPOS_CONDUCTOR,
} = require("../validators/conductores.schema");

const router = express.Router();

router.use(authMiddleware);
router.use(requireOperaciones);

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
    const texto = req.query.texto?.trim();
    const soloPropio = req.query.soloPropio === "true";
    const incluirInactivos = req.query.incluirInactivos === "true";

    if (!texto || texto.length < 1) return res.json([]);

    const where = {
      ...(!incluirInactivos && { activo: true }),
      ...(soloPropio && { propietarioSubcontratadoId: null, tipo: "PROPIO" }),
      OR: [
        { nombre: { contains: texto, mode: "insensitive" } },
        { apPaterno: { contains: texto, mode: "insensitive" } },
        { apMaterno: { contains: texto, mode: "insensitive" } },
        { nroDocumento: { contains: texto } },
        { licencia: { contains: texto, mode: "insensitive" } },
      ],
    };

    const conductores = await prisma.conductor.findMany({
      where,
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
    const texto = req.query.texto?.trim();
    const activo = req.query.activo;
    const tipo = req.query.tipo?.trim().toUpperCase();
    const tipoDocumento = req.query.tipoDocumento?.trim().toUpperCase();
    const soloPropio = req.query.soloPropio === "true";

    if (tipo && !TIPOS_CONDUCTOR.includes(tipo)) {
      return res.status(400).json({ error: `tipo invalido. Valores: ${TIPOS_CONDUCTOR.join(", ")}` });
    }

    if (tipoDocumento && !TIPOS_DOCUMENTO.includes(tipoDocumento)) {
      return res.status(400).json({ error: `tipoDocumento invalido. Valores: ${TIPOS_DOCUMENTO.join(", ")}` });
    }

    const where = {
      ...(tipo && { tipo }),
      ...(tipoDocumento && { tipoDocumento }),
      ...(activo === "true" && { activo: true }),
      ...(activo === "false" && { activo: false }),
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

    const conductores = await prisma.conductor.findMany({
      where,
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, liquidaciones: true } },
      },
      orderBy: [{ apPaterno: "asc" }, { nombre: "asc" }],
    });

    res.json(conductores);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [conductor, serviciosRecientes, liquidacionesRecientes] = await Promise.all([
      prisma.conductor.findUnique({
        where: { id: req.params.id },
        include: {
          propietarioSubcontratado: true,
          _count: { select: { servicios: true, liquidaciones: true } },
        },
      }),
      prisma.servicio.findMany({
        where: { conductorId: req.params.id },
        orderBy: { fechaServicio: "desc" },
        take: 5,
        include: {
          vehiculo: true,
          clientes: { include: { cliente: true } },
        },
      }),
      prisma.liquidacion.findMany({
        where: { conductorId: req.params.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    if (!conductor) {
      return res.status(404).json({ error: "Conductor no encontrado." });
    }

    res.json({
      ...conductor,
      serviciosRecientes,
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

    logger.info("Conductor creado", { conductorId: conductor.id, usuarioId: req.user.id });
    res.status(201).json(conductor);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const body = validate(updateConductorSchema, req.body, res);
    if (!body) return;

    const actual = await prisma.conductor.findUnique({
      where: { id: req.params.id },
      include: { propietarioSubcontratado: true },
    });

    if (!actual) {
      return res.status(404).json({ error: "Conductor no encontrado." });
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
      where: { id: req.params.id },
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

    logger.info("Conductor actualizado", { conductorId: req.params.id, usuarioId: req.user.id });
    res.json(conductor);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const conductor = await prisma.conductor.findUnique({
      where: { id: req.params.id },
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
      where: { id: req.params.id },
      data: { activo: false },
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, liquidaciones: true } },
      },
    });

    logger.info("Conductor desactivado", { conductorId: req.params.id, usuarioId: req.user.id });
    res.json({ ok: true, message: "Conductor desactivado correctamente.", conductor: actualizado });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
