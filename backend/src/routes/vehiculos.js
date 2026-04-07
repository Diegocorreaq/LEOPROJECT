const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const logger = require("../lib/logger");
const { validate } = require("../lib/validate");
const {
  createVehiculoSchema,
  updateVehiculoSchema,
  TIPOS_UNIDAD,
  TIPOS_VEHICULO,
  ESTADOS_VEHICULO,
} = require("../validators/vehiculos.schema");

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
    const texto = req.query.texto?.trim();
    const tipoUnidad = req.query.tipoUnidad?.trim().toUpperCase();
    const soloPropio = req.query.soloPropio === "true";
    const incluirInactivos = req.query.incluirInactivos === "true";

    if (!texto || texto.length < 1) return res.json([]);

    if (tipoUnidad && !TIPOS_UNIDAD.includes(tipoUnidad)) {
      return res.status(400).json({ error: `tipoUnidad invalido. Valores: ${TIPOS_UNIDAD.join(", ")}` });
    }

    const where = {
      OR: [
        { placa: { contains: texto.toUpperCase(), mode: "insensitive" } },
        { placaCarreta: { contains: texto.toUpperCase(), mode: "insensitive" } },
      ],
      ...(tipoUnidad && { tipoUnidad }),
      ...(!incluirInactivos && { estado: "ACTIVO" }),
      ...(soloPropio && { propietarioSubcontratadoId: null, tipo: "PROPIO" }),
    };

    const vehiculos = await prisma.vehiculo.findMany({
      where,
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
    const texto = req.query.texto?.trim();
    const tipo = req.query.tipo?.trim().toUpperCase();
    const estado = req.query.estado?.trim().toUpperCase();
    const soloPropio = req.query.soloPropio === "true";

    if (tipo && !TIPOS_VEHICULO.includes(tipo)) {
      return res.status(400).json({ error: `tipo invalido. Valores: ${TIPOS_VEHICULO.join(", ")}` });
    }

    if (estado && !ESTADOS_VEHICULO.includes(estado)) {
      return res.status(400).json({ error: `estado invalido. Valores: ${ESTADOS_VEHICULO.join(", ")}` });
    }

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

    const vehiculos = await prisma.vehiculo.findMany({
      where,
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, docsVehiculo: true, mantenimientos: true } },
      },
      orderBy: { placa: "asc" },
    });

    res.json(vehiculos);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [vehiculo, serviciosRecientes] = await Promise.all([
      prisma.vehiculo.findUnique({
        where: { id: req.params.id },
        include: {
          propietarioSubcontratado: true,
          docsVehiculo: true,
          mantenimientos: true,
          _count: { select: { servicios: true, docsVehiculo: true, mantenimientos: true } },
        },
      }),
      prisma.servicio.findMany({
        where: { vehiculoId: req.params.id },
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

    res.json({ ...vehiculo, serviciosRecientes });
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

    logger.info("Vehiculo creado", { vehiculoId: vehiculo.id, usuarioId: req.user.id });
    res.status(201).json(vehiculo);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const body = validate(updateVehiculoSchema, req.body, res);
    if (!body) return;

    const actual = await prisma.vehiculo.findUnique({
      where: { id: req.params.id },
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
      where: { id: req.params.id },
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

    logger.info("Vehiculo actualizado", { vehiculoId: req.params.id, usuarioId: req.user.id });
    res.json(vehiculo);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: req.params.id },
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
      where: { id: req.params.id },
      data: { estado: "INACTIVO" },
      include: {
        propietarioSubcontratado: true,
        _count: { select: { servicios: true, docsVehiculo: true, mantenimientos: true } },
      },
    });

    logger.info("Vehiculo desactivado", { vehiculoId: req.params.id, usuarioId: req.user.id });
    res.json({ ok: true, message: "Vehiculo desactivado correctamente.", vehiculo: actualizado });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
