/**
 * servicios.js — CRUD de servicios de transporte
 *
 * Cambios de seguridad aplicados:
 *  - Validación Zod en POST y PATCH
 *  - Transacciones Prisma en POST (subcontratado) y PUT (actualización de clientes)
 *  - RBAC: requireOperaciones en todas las rutas
 *  - Logging de auditoría en creación y cambio de estado
 */

const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const logger = require("../lib/logger");
const { validate } = require("../lib/validate");
const {
  createServicioSchema,
  updateServicioSchema,
  patchEstadoSchema,
} = require("../validators/servicios.schema");

const router = express.Router();
router.use(authMiddleware);
router.use(requireOperaciones);

async function validarRecursosPropiosActivos(db, { vehiculoId, conductorId }) {
  const [vehiculo, conductor] = await Promise.all([
    db.vehiculo.findUnique({
      where: { id: vehiculoId },
      select: { id: true, tipo: true, estado: true },
    }),
    db.conductor.findUnique({
      where: { id: conductorId },
      select: { id: true, tipo: true, activo: true },
    }),
  ]);

  if (!vehiculo || vehiculo.tipo !== "PROPIO") {
    return { status: 400, error: "Debes seleccionar un vehiculo propio valido." };
  }

  if (vehiculo.estado !== "ACTIVO") {
    return { status: 409, error: "Solo puedes registrar servicios con vehiculos propios activos." };
  }

  if (!conductor || conductor.tipo !== "PROPIO") {
    return { status: 400, error: "Debes seleccionar un conductor propio valido." };
  }

  if (!conductor.activo) {
    return { status: 409, error: "Solo puedes registrar servicios con conductores propios activos." };
  }

  return null;
}

// Relaciones estándar en queries
const servicioInclude = {
  vehiculo:  { include: { propietarioSubcontratado: true } },
  conductor: { include: { propietarioSubcontratado: true } },
  clientes:  { include: { cliente: true } },
  guias:        true,
  liquidacion:  true,
  orden:        true,
};

// ── GET /api/servicios ─────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const servicios = await prisma.servicio.findMany({
      include: servicioInclude,
      orderBy: { createdAt: "asc" },
    });

    // Generar código SVC-YYMM-NNN estable por mes
    const counters = {};
    servicios.forEach((s) => {
      const d = new Date(s.createdAt);
      const yy = String(d.getUTCFullYear()).slice(2);
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const key = `${yy}${mm}`;
      counters[key] = (counters[key] || 0) + 1;
      s.codigo = `SVC-${key}-${String(counters[key]).padStart(3, "0")}`;
    });

    servicios.sort((a, b) => new Date(b.fechaServicio) - new Date(a.fechaServicio));
    res.json(servicios);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/servicios/:id ─────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const servicio = await prisma.servicio.findUnique({
      where: { id: req.params.id },
      include: servicioInclude,
    });
    if (!servicio) return res.status(404).json({ error: "Servicio no encontrado" });
    res.json(servicio);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/servicios ────────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    // Validar con Zod
    const body = validate(createServicioSchema, req.body, res);
    if (!body) return;

    const {
      fechaServicio,
      origen,
      destino,
      estado,
      observaciones,
      tipoContrato,
      vehiculoId,
      conductorId,
      subcontratado,
      clienteIds,
    } = body;

    let finalVehiculoId = vehiculoId;
    let finalConductorId = conductorId;

    if (tipoContrato === "PROPIO") {
      const validacion = await validarRecursosPropiosActivos(prisma, {
        vehiculoId: finalVehiculoId,
        conductorId: finalConductorId,
      });

      if (validacion) {
        return res.status(validacion.status).json({ error: validacion.error });
      }
    }

    // ── Transacción para SUBCONTRATADO ────────────────────────────────────
    if (tipoContrato === "SUBCONTRATADO" && subcontratado) {
      const { empresa, vehiculo: veh, conductor: cond } = subcontratado;

      const resultado = await prisma.$transaction(async (tx) => {
        // Buscar o crear propietario subcontratado por RUC
        let propietario = await tx.propietarioSubcontratado.findUnique({
          where: { ruc: empresa.ruc },
        });
        if (!propietario) {
          propietario = await tx.propietarioSubcontratado.create({
            data: {
              razonSocial: empresa.razonSocial,
              ruc: empresa.ruc,
              contacto: empresa.contacto || null,
              telefono: empresa.telefono || null,
            },
          });
        }

        // Buscar o crear vehículo por placa
        let vehiculo = await tx.vehiculo.findUnique({ where: { placa: veh.placa } });
        if (!vehiculo) {
          vehiculo = await tx.vehiculo.create({
            data: {
              placa: veh.placa,
              placaCarreta: veh.placaCarreta || null,
              tipoUnidad: veh.tipoUnidad || "CAMION",
              tipo: "SUBCONTRATADO",
              propietarioSubcontratadoId: propietario.id,
            },
          });
        }

        // Buscar o crear conductor por nroDocumento
        let conductor = await tx.conductor.findFirst({
          where: { nroDocumento: cond.nroDocumento },
        });
        if (!conductor) {
          conductor = await tx.conductor.create({
            data: {
              nombre: cond.nombre,
              apPaterno: cond.apPaterno,
              apMaterno: cond.apMaterno || null,
              tipoDocumento: cond.tipoDocumento || "DNI",
              nroDocumento: cond.nroDocumento,
              licencia: cond.licencia || null,
              tipo: "SUBCONTRATADO",
              propietarioSubcontratadoId: propietario.id,
            },
          });
        }

        // Crear servicio dentro de la transacción
        const servicio = await tx.servicio.create({
          data: {
            fechaServicio: new Date(fechaServicio),
            origen,
            destino,
            estado,
            observaciones: observaciones || null,
            vehiculoId: vehiculo.id,
            conductorId: conductor.id,
            clientes: {
              create: clienteIds.map((clienteId) => ({ clienteId })),
            },
          },
          include: servicioInclude,
        });

        return servicio;
      });

      logger.info("Servicio SUBCONTRATADO creado", {
        servicioId: resultado.id,
        usuarioId: req.user.id,
        clienteIds,
      });

      return res.status(201).json(resultado);
    }

    // ── PROPIO: crear servicio directamente ───────────────────────────────
    const servicio = await prisma.servicio.create({
      data: {
        fechaServicio: new Date(fechaServicio),
        origen,
        destino,
        estado,
        observaciones: observaciones || null,
        vehiculoId: finalVehiculoId,
        conductorId: finalConductorId,
        clientes: {
          create: clienteIds.map((clienteId) => ({ clienteId })),
        },
      },
      include: servicioInclude,
    });

    logger.info("Servicio PROPIO creado", {
      servicioId: servicio.id,
      usuarioId: req.user.id,
      vehiculoId: finalVehiculoId,
      conductorId: finalConductorId,
      clienteIds,
    });

    res.status(201).json(servicio);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/servicios/:id ─────────────────────────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    // Validar campos base con Zod
    const body = validate(updateServicioSchema, req.body, res);
    if (!body) return;

    // Campos extra leídos directamente (no validados por updateServicioSchema)
    const {
      tipoContrato,
      vehiculoId,
      conductorId,
      subcontratado,
      clienteIds,      // array de UUIDs (formato nuevo)
      clientes,        // array de {razonSocial, ruc} (formato legacy)
    } = req.body;

    const { fechaServicio, origen, destino, estado, observaciones } = body;

    const existing = await prisma.servicio.findUnique({
      where: { id: req.params.id },
      include: {
        vehiculo: {
          select: { tipo: true },
        },
      },
    });
    if (!existing) return res.status(404).json({ error: "Servicio no encontrado" });

    const tipoContratoFinal = tipoContrato ?? (existing.vehiculo?.tipo === "SUBCONTRATADO" ? "SUBCONTRATADO" : "PROPIO");
    const finalVehiculoPropioId = tipoContratoFinal === "PROPIO"
      ? (vehiculoId || existing.vehiculoId)
      : null;
    const finalConductorPropioId = tipoContratoFinal === "PROPIO"
      ? (conductorId || existing.conductorId)
      : null;

    if (tipoContratoFinal === "PROPIO") {
      const validacion = await validarRecursosPropiosActivos(prisma, {
        vehiculoId: finalVehiculoPropioId,
        conductorId: finalConductorPropioId,
      });

      if (validacion) {
        return res.status(validacion.status).json({ error: validacion.error });
      }
    }

    const servicio = await prisma.$transaction(async (tx) => {
      // ── Resolver vehículo y conductor finales ─────────────────────────────
      let finalVehiculoId  = existing.vehiculoId;
      let finalConductorId = existing.conductorId;

      if (tipoContrato === "PROPIO") {
        if (vehiculoId)  finalVehiculoId  = vehiculoId;
        if (conductorId) finalConductorId = conductorId;

      } else if (tipoContrato === "SUBCONTRATADO" && subcontratado) {
        const { empresa, vehiculo: veh, conductor: cond } = subcontratado;

        // Buscar o crear propietario por RUC
        let propietario = await tx.propietarioSubcontratado.findUnique({
          where: { ruc: empresa.ruc },
        });
        if (!propietario) {
          propietario = await tx.propietarioSubcontratado.create({
            data: {
              razonSocial: empresa.razonSocial,
              ruc: empresa.ruc,
              contacto: empresa.contacto || null,
              telefono: empresa.telefono || null,
            },
          });
        }

        // Buscar o crear vehículo por placa
        let vehiculo = await tx.vehiculo.findUnique({ where: { placa: veh.placa } });
        if (!vehiculo) {
          vehiculo = await tx.vehiculo.create({
            data: {
              placa: veh.placa,
              placaCarreta: veh.placaCarreta || null,
              tipoUnidad: veh.tipoUnidad || "CAMION",
              tipo: "SUBCONTRATADO",
              propietarioSubcontratadoId: propietario.id,
            },
          });
        }
        finalVehiculoId = vehiculo.id;

        // Buscar o crear conductor por nroDocumento
        let conductor = await tx.conductor.findFirst({
          where: { nroDocumento: cond.nroDocumento },
        });
        if (!conductor) {
          conductor = await tx.conductor.create({
            data: {
              nombre: cond.nombre,
              apPaterno: cond.apPaterno,
              apMaterno: cond.apMaterno || null,
              tipoDocumento: cond.tipoDocumento || "DNI",
              nroDocumento: cond.nroDocumento,
              licencia: cond.licencia || null,
              tipo: "SUBCONTRATADO",
              propietarioSubcontratadoId: propietario.id,
            },
          });
        }
        finalConductorId = conductor.id;
      }

      // ── Actualizar clientes ───────────────────────────────────────────────
      if (Array.isArray(clienteIds)) {
        // Formato nuevo: array de UUIDs
        await tx.servicioCliente.deleteMany({ where: { servicioId: req.params.id } });
        if (clienteIds.length > 0) {
          await tx.servicioCliente.createMany({
            data: clienteIds.map((cid) => ({ servicioId: req.params.id, clienteId: cid })),
          });
        }
      } else if (Array.isArray(clientes)) {
        // Formato legacy: array de {razonSocial, ruc}
        await tx.servicioCliente.deleteMany({ where: { servicioId: req.params.id } });
        const resolvedIds = await Promise.all(
          clientes.map(async ({ razonSocial, ruc }) => {
            let c = await tx.cliente.findUnique({ where: { ruc } });
            if (!c) c = await tx.cliente.create({ data: { razonSocial, ruc } });
            return c.id;
          })
        );
        if (resolvedIds.length > 0) {
          await tx.servicioCliente.createMany({
            data: resolvedIds.map((cid) => ({ servicioId: req.params.id, clienteId: cid })),
          });
        }
      }

      // ── Actualizar el servicio ────────────────────────────────────────────
      return tx.servicio.update({
        where: { id: req.params.id },
        data: {
          ...(fechaServicio && { fechaServicio: new Date(fechaServicio) }),
          ...(origen        && { origen }),
          ...(destino       && { destino }),
          ...(estado        && { estado }),
          ...(observaciones !== undefined && { observaciones }),
          vehiculoId:  finalVehiculoId,
          conductorId: finalConductorId,
        },
        include: servicioInclude,
      });
    });

    logger.info("Servicio actualizado", { servicioId: req.params.id, usuarioId: req.user.id });
    res.json(servicio);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/servicios/:id/estado ───────────────────────────────────────
router.patch("/:id/estado", async (req, res, next) => {
  try {
    const body = validate(patchEstadoSchema, req.body, res);
    if (!body) return;

    const servicio = await prisma.servicio.update({
      where: { id: req.params.id },
      data: { estado: body.estado },
      include: servicioInclude,
    });

    logger.info("Estado de servicio actualizado", {
      servicioId: req.params.id,
      estadoAnterior: req.body._estadoAnterior, // si el cliente lo envía
      estadoNuevo: body.estado,
      usuarioId: req.user.id,
    });

    res.json(servicio);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
