const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const { recordAuditEvent } = require("../lib/audit");
const {
  buildEstadoServicioWhere,
  normalizeEstadoServicio,
  serializeServicioEstado,
} = require("../lib/servicioEstado");
const { applyPaginationHeaders, resolvePagination } = require("../lib/pagination");
const { validate, validateRequest } = require("../lib/validate");
const {
  createServicioSchema,
  listServiciosQuerySchema,
  patchEstadoSchema,
  servicioIdParamSchema,
  updateServicioSchema,
} = require("../validators/servicios.schema");

const router = express.Router();
router.use(authMiddleware);
router.use(requireOperaciones);

const ubigeoSelect = {
  codigo: true,
  distrito: true,
  provincia: true,
  departamento: true,
  etiqueta: true,
};

const servicioDetailInclude = {
  vehiculo: { include: { propietarioSubcontratado: true } },
  conductor: { include: { propietarioSubcontratado: true } },
  clientes: { include: { cliente: true } },
  origenUbigeo: { select: ubigeoSelect },
  destinoUbigeo: { select: ubigeoSelect },
  guias: true,
  liquidacion: true,
  orden: true,
};

const servicioListInclude = {
  vehiculo: { select: { id: true, placa: true, placaCarreta: true, tipo: true, tipoUnidad: true } },
  conductor: { select: { id: true, nombre: true, apPaterno: true, apMaterno: true, nroDocumento: true } },
  clientes: { include: { cliente: true } },
  origenUbigeo: { select: ubigeoSelect },
  destinoUbigeo: { select: ubigeoSelect },
  guias: { select: { id: true } },
  liquidacion: { select: { id: true, status: true } },
  orden: { select: { id: true, rutaTarifaId: true } },
};

function addServiceCodes(servicios) {
  const counters = {};

  servicios.forEach((servicio) => {
    const date = new Date(servicio.createdAt);
    const yy = String(date.getUTCFullYear()).slice(2);
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const key = `${yy}${mm}`;
    counters[key] = (counters[key] || 0) + 1;
    servicio.codigo = `SVC-${key}-${String(counters[key]).padStart(3, "0")}`;
    servicio.estado = normalizeEstadoServicio(servicio.estado);
  });

  return servicios;
}

function getTipoContrato(servicio) {
  return servicio?.vehiculo?.tipo === "SUBCONTRATADO" ? "SUBCONTRATADO" : "PROPIO";
}

function toCalendarDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(`${value.trim()}T12:00:00.000Z`);
  }
  return new Date(value);
}

function formatUbigeoDisplay(ubigeo) {
  return `${ubigeo.distrito} - ${ubigeo.departamento}`;
}

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

async function upsertPropietario(db, propietario) {
  if (!propietario) return null;

  return db.propietarioSubcontratado.upsert({
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

async function resolveSubcontratadoResources(db, subcontratado) {
  const { empresa, vehiculo: vehiculoInput, conductor: conductorInput } = subcontratado;
  const propietario = await upsertPropietario(db, empresa);

  let vehiculo = await db.vehiculo.findUnique({ where: { placa: vehiculoInput.placa } });
  if (!vehiculo) {
    vehiculo = await db.vehiculo.create({
      data: {
        placa: vehiculoInput.placa,
        placaCarreta: vehiculoInput.placaCarreta ?? null,
        tipoUnidad: vehiculoInput.tipoUnidad ?? "CAMION",
        tipo: "SUBCONTRATADO",
        propietarioSubcontratadoId: propietario.id,
      },
    });
  }

  let conductor = await db.conductor.findFirst({
    where: { nroDocumento: conductorInput.nroDocumento },
  });
  if (!conductor) {
    conductor = await db.conductor.create({
      data: {
        nombre: conductorInput.nombre,
        apPaterno: conductorInput.apPaterno,
        apMaterno: conductorInput.apMaterno ?? null,
        tipoDocumento: conductorInput.tipoDocumento,
        nroDocumento: conductorInput.nroDocumento,
        licencia: conductorInput.licencia ?? null,
        tipo: "SUBCONTRATADO",
        propietarioSubcontratadoId: propietario.id,
      },
    });
  }

  return {
    vehiculoId: vehiculo.id,
    conductorId: conductor.id,
  };
}

async function resolveUbigeoByCodigo(db, codigo, fieldName) {
  const ubigeo = await db.ubigeo.findUnique({
    where: { codigo },
    select: ubigeoSelect,
  });

  if (!ubigeo) {
    const error = new Error(`El ${fieldName} seleccionado no existe en el maestro de ubigeo.`);
    error.status = 400;
    throw error;
  }

  return ubigeo;
}

async function resolveServicioUbigeos(db, payload) {
  const [origenUbigeo, destinoUbigeo] = await Promise.all([
    resolveUbigeoByCodigo(db, payload.origenUbigeoCodigo, "origen"),
    resolveUbigeoByCodigo(db, payload.destinoUbigeoCodigo, "destino"),
  ]);

  return {
    origenUbigeo,
    destinoUbigeo,
    origen: formatUbigeoDisplay(origenUbigeo),
    destino: formatUbigeoDisplay(destinoUbigeo),
  };
}

async function resolveClienteIds(db, payload) {
  if (Array.isArray(payload.clienteIds)) {
    const uniqueIds = Array.from(new Set(payload.clienteIds));

    const clientes = await db.cliente.findMany({
      where: {
        id: { in: uniqueIds },
        activo: true,
      },
      select: { id: true },
    });

    if (clientes.length !== uniqueIds.length) {
      const error = new Error("Todos los clientes vinculados deben existir y estar activos.");
      error.status = 409;
      throw error;
    }

    return uniqueIds;
  }

  if (Array.isArray(payload.clientes)) {
    const ids = [];

    for (const clienteInput of payload.clientes) {
      const existing = await db.cliente.findUnique({
        where: { ruc: clienteInput.ruc },
        select: { id: true, activo: true },
      });

      if (existing) {
        if (!existing.activo) {
          const error = new Error(`El cliente con RUC ${clienteInput.ruc} existe pero esta inactivo.`);
          error.status = 409;
          throw error;
        }

        ids.push(existing.id);
        continue;
      }

      const created = await db.cliente.create({
        data: {
          razonSocial: clienteInput.razonSocial,
          ruc: clienteInput.ruc,
          email: clienteInput.email ?? null,
          telefono: clienteInput.telefono ?? null,
          direccion: clienteInput.direccion ?? null,
          activo: true,
        },
        select: { id: true },
      });

      ids.push(created.id);
    }

    return Array.from(new Set(ids));
  }

  return [];
}

function buildServicioWhere(query) {
  const where = {};
  const and = [];

  if (query.estado) {
    and.push({ estado: buildEstadoServicioWhere(query.estado) });
  }

  if (query.tipoContrato === "PROPIO") {
    and.push({ vehiculo: { is: { tipo: "PROPIO" } } });
  } else if (query.tipoContrato === "SUBCONTRATADO") {
    and.push({ vehiculo: { is: { tipo: "SUBCONTRATADO" } } });
  }

  if (query.conObservaciones) {
    and.push({ observaciones: { not: null } });
  }

  if (query.texto) {
    and.push({
      OR: [
        { origen: { contains: query.texto, mode: "insensitive" } },
        { destino: { contains: query.texto, mode: "insensitive" } },
        { vehiculo: { is: { placa: { contains: query.texto, mode: "insensitive" } } } },
        { clientes: { some: { cliente: { razonSocial: { contains: query.texto, mode: "insensitive" } } } } },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

router.get("/", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: listServiciosQuerySchema }, req, res);
    if (!validated) return;

    const { query } = validated;
    const pagination = resolvePagination(query, { defaultLimit: 100, maxLimit: 100 });
    const where = buildServicioWhere(query);

    const [total, servicios] = await Promise.all([
      prisma.servicio.count({ where }),
      prisma.servicio.findMany({
        where,
        include: servicioListInclude,
        orderBy: [{ fechaServicio: "desc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    applyPaginationHeaders(res, { ...pagination, total });
    res.json(addServiceCodes(servicios));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: servicioIdParamSchema }, req, res);
    if (!validated) return;

    const servicio = await prisma.servicio.findUnique({
      where: { id: validated.params.id },
      include: servicioDetailInclude,
    });

    if (!servicio) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    res.json(serializeServicioEstado(servicio));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = validate(createServicioSchema, req.body, res);
    if (!body) return;

    const servicio = await prisma.$transaction(async (tx) => {
      const clienteIds = await resolveClienteIds(tx, body);

      let vehiculoId = body.vehiculoId;
      let conductorId = body.conductorId;

      if (body.tipoContrato === "PROPIO") {
        const validacion = await validarRecursosPropiosActivos(tx, { vehiculoId, conductorId });
        if (validacion) {
          const error = new Error(validacion.error);
          error.status = validacion.status;
          throw error;
        }
      } else {
        const resources = await resolveSubcontratadoResources(tx, body.subcontratado);
        vehiculoId = resources.vehiculoId;
        conductorId = resources.conductorId;
      }

      const ruta = await resolveServicioUbigeos(tx, body);

      return tx.servicio.create({
        data: {
          fechaServicio: toCalendarDate(body.fechaServicio),
          origen: ruta.origen,
          destino: ruta.destino,
          origenUbigeoCodigo: ruta.origenUbigeo.codigo,
          destinoUbigeoCodigo: ruta.destinoUbigeo.codigo,
          estado: normalizeEstadoServicio(body.estado),
          observaciones: body.observaciones ?? null,
          vehiculoId,
          conductorId,
          clientes: {
            create: clienteIds.map((clienteId) => ({ clienteId })),
          },
        },
        include: servicioDetailInclude,
      });
    });

    req.log.info("Servicio creado", {
      servicioId: servicio.id,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "Servicio",
      entityId: servicio.id,
      action: "create",
      req,
      metadata: {
        tipoContrato: getTipoContrato(servicio),
        clienteIds: servicio.clientes.map((item) => item.clienteId),
      },
    });

    res.status(201).json(serializeServicioEstado(servicio));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: servicioIdParamSchema }, req, res);
    if (!validated) return;

    const body = validate(updateServicioSchema, req.body, res);
    if (!body) return;

    const existing = await prisma.servicio.findUnique({
      where: { id: validated.params.id },
      include: {
        vehiculo: { include: { propietarioSubcontratado: true } },
        conductor: { include: { propietarioSubcontratado: true } },
        clientes: true,
        origenUbigeo: { select: ubigeoSelect },
        destinoUbigeo: { select: ubigeoSelect },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    const tipoContratoFinal = body.tipoContrato ?? (existing.vehiculo?.tipo === "SUBCONTRATADO" ? "SUBCONTRATADO" : "PROPIO");
    const origenActualizado = body.origen !== undefined || body.origenUbigeoCodigo !== undefined;
    const destinoActualizado = body.destino !== undefined || body.destinoUbigeoCodigo !== undefined;

    const servicio = await prisma.$transaction(async (tx) => {
      let finalVehiculoId = existing.vehiculoId;
      let finalConductorId = existing.conductorId;
      let finalClienteIds = existing.clientes.map((item) => item.clienteId);
      let finalOrigen = existing.origen;
      let finalDestino = existing.destino;
      let finalOrigenUbigeoCodigo = existing.origenUbigeoCodigo ?? null;
      let finalDestinoUbigeoCodigo = existing.destinoUbigeoCodigo ?? null;

      if (body.clienteIds || body.clientes) {
        finalClienteIds = await resolveClienteIds(tx, body);
      }

      if (tipoContratoFinal === "PROPIO") {
        finalVehiculoId = body.vehiculoId ?? existing.vehiculoId;
        finalConductorId = body.conductorId ?? existing.conductorId;

        const validacion = await validarRecursosPropiosActivos(tx, {
          vehiculoId: finalVehiculoId,
          conductorId: finalConductorId,
        });

        if (validacion) {
          const error = new Error(validacion.error);
          error.status = validacion.status;
          throw error;
        }
      } else if (body.subcontratado) {
        const resources = await resolveSubcontratadoResources(tx, body.subcontratado);
        finalVehiculoId = resources.vehiculoId;
        finalConductorId = resources.conductorId;
      } else if (existing.vehiculo?.tipo !== "SUBCONTRATADO") {
        const error = new Error("Debes enviar el bloque subcontratado para cambiar el servicio a SUBCONTRATADO.");
        error.status = 400;
        throw error;
      }

      if (origenActualizado) {
        if (!body.origenUbigeoCodigo) {
          const error = new Error("Debes seleccionar un ubigeo valido para el origen.");
          error.status = 400;
          throw error;
        }

        const origenUbigeo = await resolveUbigeoByCodigo(tx, body.origenUbigeoCodigo, "origen");
        finalOrigenUbigeoCodigo = origenUbigeo.codigo;
        finalOrigen = formatUbigeoDisplay(origenUbigeo);
      }

      if (destinoActualizado) {
        if (!body.destinoUbigeoCodigo) {
          const error = new Error("Debes seleccionar un ubigeo valido para el destino.");
          error.status = 400;
          throw error;
        }

        const destinoUbigeo = await resolveUbigeoByCodigo(tx, body.destinoUbigeoCodigo, "destino");
        finalDestinoUbigeoCodigo = destinoUbigeo.codigo;
        finalDestino = formatUbigeoDisplay(destinoUbigeo);
      }

      await tx.servicioCliente.deleteMany({ where: { servicioId: existing.id } });
      if (finalClienteIds.length > 0) {
        await tx.servicioCliente.createMany({
          data: finalClienteIds.map((clienteId) => ({
            servicioId: existing.id,
            clienteId,
          })),
        });
      }

      return tx.servicio.update({
        where: { id: existing.id },
        data: {
          ...(body.fechaServicio !== undefined && { fechaServicio: toCalendarDate(body.fechaServicio) }),
          ...(origenActualizado && {
            origen: finalOrigen,
            origenUbigeoCodigo: finalOrigenUbigeoCodigo,
          }),
          ...(destinoActualizado && {
            destino: finalDestino,
            destinoUbigeoCodigo: finalDestinoUbigeoCodigo,
          }),
          ...(body.estado !== undefined && { estado: normalizeEstadoServicio(body.estado) }),
          ...(body.observaciones !== undefined && { observaciones: body.observaciones }),
          vehiculoId: finalVehiculoId,
          conductorId: finalConductorId,
        },
        include: servicioDetailInclude,
      });
    });

    req.log.info("Servicio actualizado", {
      servicioId: servicio.id,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "Servicio",
      entityId: servicio.id,
      action: "update",
      req,
      metadata: {
        campos: Object.keys(body),
        tipoContratoFinal,
      },
    });

    res.json(serializeServicioEstado(servicio));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/estado", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: servicioIdParamSchema }, req, res);
    if (!validated) return;

    const body = validate(patchEstadoSchema, req.body, res);
    if (!body) return;

    const existing = await prisma.servicio.findUnique({
      where: { id: validated.params.id },
      select: { id: true, estado: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    const servicio = await prisma.servicio.update({
      where: { id: existing.id },
      data: { estado: normalizeEstadoServicio(body.estado) },
      include: servicioDetailInclude,
    });

    req.log.info("Estado de servicio actualizado", {
      servicioId: servicio.id,
      estadoAnterior: existing.estado,
      estadoNuevo: normalizeEstadoServicio(body.estado),
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "Servicio",
      entityId: servicio.id,
      action: "status_change",
      req,
      metadata: {
        estadoAnterior: existing.estado,
        estadoNuevo: normalizeEstadoServicio(body.estado),
      },
    });

    res.json(serializeServicioEstado(servicio));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
