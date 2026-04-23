const { z } = require("zod");
const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const { recordAuditEvent } = require("../lib/audit");
const { validate, validateRequest } = require("../lib/validate");
const { idParamSchema } = require("../validators/common.schema");
const {
  TIPOS_DOC,
  TIPOS_DOC_LABELS,
  COMPONENTES_KM,
  COMPONENTES_KM_LABELS,
  upsertDocVehiculoSchema,
  updateMantenimientoSchema,
} = require("../validators/flota.schema");

const router = express.Router();

router.use(authMiddleware);
router.use(requireOperaciones);

const tipodocParamSchema = z.object({
  id: z.string().uuid("id de vehiculo invalido"),
  tipoDoc: z.enum(TIPOS_DOC, {
    errorMap: () => ({ message: `tipoDoc invalido. Valores: ${TIPOS_DOC.join(", ")}` }),
  }),
});

const componenteParamSchema = z.object({
  id: z.string().uuid("id de vehiculo invalido"),
  componente: z.enum(COMPONENTES_KM, {
    errorMap: () => ({ message: `componente invalido. Valores: ${COMPONENTES_KM.join(", ")}` }),
  }),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDocStatus(fechaVencimiento) {
  if (!fechaVencimiento) return "SIN_FECHA";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en30Dias = new Date(hoy);
  en30Dias.setDate(en30Dias.getDate() + 30);
  const vence = new Date(fechaVencimiento);
  if (vence < hoy) return "VENCIDO";
  if (vence <= en30Dias) return "POR_VENCER";
  return "VIGENTE";
}

function getDiasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaVencimiento);
  return Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function getPorcentajeUso(kmAcumulado, kmPermitido) {
  const km = Number(kmPermitido ?? 0);
  if (km === 0) return 0;
  return Math.round((Number(kmAcumulado ?? 0) / km) * 1000) / 10;
}

function getMantenimientoStatus(kmAcumulado, kmPermitido) {
  const km = Number(kmPermitido ?? 0);
  if (km === 0) return "SIN_CONFIGURAR";
  const pct = (Number(kmAcumulado ?? 0) / km) * 100;
  if (pct >= 100) return "VENCIDO";
  if (pct >= 80) return "POR_VENCER";
  return "VIGENTE";
}

function buildDocumentos(docsVehiculo) {
  return TIPOS_DOC.map((tipoDoc) => {
    const doc = docsVehiculo.find((d) => d.tipoDoc === tipoDoc) ?? null;
    return {
      tipoDoc,
      label: TIPOS_DOC_LABELS[tipoDoc],
      fechaVencimiento: doc?.fechaVencimiento ?? null,
      fechaAnterior: doc?.fechaAnterior ?? null,
      observacion: doc?.observacion ?? null,
      estadoDoc: getDocStatus(doc?.fechaVencimiento),
      diasRestantes: getDiasRestantes(doc?.fechaVencimiento),
    };
  });
}

function buildComponentes(mantenimientos) {
  return COMPONENTES_KM.map((componente) => {
    const m = mantenimientos.find((x) => x.componente === componente) ?? null;
    const kmAcumulado = Number(m?.kmAcumulado ?? 0);
    const kmPermitido = Number(m?.kmPermitido ?? 0);
    const rendimientoEstandar = Number(m?.rendimientoEstandar ?? 0);
    const porcentajeUso = getPorcentajeUso(kmAcumulado, kmPermitido);
    const kmRestantes = kmPermitido > 0 ? Math.max(0, kmPermitido - kmAcumulado) : null;
    return {
      componente,
      label: COMPONENTES_KM_LABELS[componente],
      kmPermitido,
      kmAcumulado,
      kmRestantes,
      rendimientoEstandar,
      porcentajeUso,
      estadoMantenimiento: getMantenimientoStatus(kmAcumulado, kmPermitido),
    };
  });
}

function serializeVehiculoBase(v) {
  return {
    id: v.id,
    placa: v.placa,
    placaCarreta: v.placaCarreta ?? null,
    tipo: v.tipo,
    tipoUnidad: v.tipoUnidad,
    estado: v.estado,
    propietario: v.propietarioSubcontratado?.razonSocial ?? "Propio",
  };
}

async function requireVehiculoActivo(db, vehiculoId) {
  const vehiculo = await db.vehiculo.findUnique({
    where: { id: vehiculoId },
    select: { id: true, tipo: true, estado: true },
  });
  if (!vehiculo) return { error: "Vehiculo no encontrado.", status: 404 };
  return { vehiculo };
}

// ── Documentación ─────────────────────────────────────────────────────────────

router.get("/documentacion", async (req, res, next) => {
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: { estado: "ACTIVO" },
      include: { propietarioSubcontratado: true, docsVehiculo: true },
      orderBy: { placa: "asc" },
    });

    res.json(
      vehiculos.map((v) => ({
        ...serializeVehiculoBase(v),
        documentos: buildDocumentos(v.docsVehiculo),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/documentacion/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: validated.params.id },
      include: { propietarioSubcontratado: true, docsVehiculo: true },
    });

    if (!vehiculo) return res.status(404).json({ error: "Vehiculo no encontrado." });

    res.json({
      ...serializeVehiculoBase(vehiculo),
      documentos: buildDocumentos(vehiculo.docsVehiculo),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/documentacion/:id/:tipoDoc", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: tipodocParamSchema }, req, res);
    if (!validated) return;

    const body = validate(upsertDocVehiculoSchema, req.body, res);
    if (!body) return;

    const { id: vehiculoId, tipoDoc } = validated.params;

    const { error, status } = await requireVehiculoActivo(prisma, vehiculoId);
    if (error) return res.status(status).json({ error });

    const existing = await prisma.docVehiculo.findUnique({
      where: { vehiculoId_tipoDoc: { vehiculoId, tipoDoc } },
    });

    // Mover fechaVencimiento actual a fechaAnterior antes de actualizar
    const fechaAnteriorNueva =
      body.fechaVencimiento !== undefined
        ? (existing?.fechaVencimiento ?? null)
        : existing?.fechaAnterior ?? null;

    const doc = await prisma.docVehiculo.upsert({
      where: { vehiculoId_tipoDoc: { vehiculoId, tipoDoc } },
      create: {
        vehiculoId,
        tipoDoc,
        fechaVencimiento: body.fechaVencimiento ?? null,
        fechaAnterior: null,
        observacion: body.observacion ?? null,
      },
      update: {
        ...(body.fechaVencimiento !== undefined && {
          fechaVencimiento: body.fechaVencimiento,
          fechaAnterior: fechaAnteriorNueva,
        }),
        ...(body.observacion !== undefined && { observacion: body.observacion }),
      },
    });

    req.log.info("DocVehiculo actualizado", { vehiculoId, tipoDoc, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "DocVehiculo",
      entityId: doc.id,
      action: "upsert",
      req,
      metadata: {
        vehiculoId,
        tipoDoc,
        fechaVencimientoNueva: doc.fechaVencimiento,
        fechaAnterior: doc.fechaAnterior,
      },
    });

    res.json({
      ...doc,
      label: TIPOS_DOC_LABELS[tipoDoc],
      estadoDoc: getDocStatus(doc.fechaVencimiento),
      diasRestantes: getDiasRestantes(doc.fechaVencimiento),
    });
  } catch (err) {
    next(err);
  }
});

// ── Mantenimiento por km ───────────────────────────────────────────────────────

router.get("/mantenimiento", async (req, res, next) => {
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: { estado: "ACTIVO", tipo: "PROPIO" },
      include: { mantenimientos: true },
      orderBy: { placa: "asc" },
    });

    res.json(
      vehiculos.map((v) => ({
        ...serializeVehiculoBase(v),
        componentes: buildComponentes(v.mantenimientos),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/mantenimiento/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: validated.params.id },
      include: { propietarioSubcontratado: true, mantenimientos: true },
    });

    if (!vehiculo) return res.status(404).json({ error: "Vehiculo no encontrado." });

    res.json({
      ...serializeVehiculoBase(vehiculo),
      componentes: buildComponentes(vehiculo.mantenimientos),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/mantenimiento/:id/:componente", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: componenteParamSchema }, req, res);
    if (!validated) return;

    const body = validate(updateMantenimientoSchema, req.body, res);
    if (!body) return;

    const { id: vehiculoId, componente } = validated.params;

    const { vehiculo, error, status } = await requireVehiculoActivo(prisma, vehiculoId);
    if (error) return res.status(status).json({ error });

    if (vehiculo.tipo !== "PROPIO") {
      return res.status(422).json({ error: "El mantenimiento por km solo aplica a vehiculos propios." });
    }

    const m = await prisma.mantenimientoKm.upsert({
      where: { vehiculoId_componente: { vehiculoId, componente } },
      create: {
        vehiculoId,
        componente,
        kmPermitido: body.kmPermitido ?? 0,
        kmAcumulado: 0,
        rendimientoEstandar: body.rendimientoEstandar ?? 0,
      },
      update: {
        ...(body.kmPermitido !== undefined && { kmPermitido: body.kmPermitido }),
        ...(body.rendimientoEstandar !== undefined && { rendimientoEstandar: body.rendimientoEstandar }),
      },
    });

    req.log.info("MantenimientoKm actualizado", { vehiculoId, componente, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "MantenimientoKm",
      entityId: m.id,
      action: "update",
      req,
      metadata: { vehiculoId, componente, campos: Object.keys(body) },
    });

    res.json({
      componente,
      label: COMPONENTES_KM_LABELS[componente],
      kmPermitido: Number(m.kmPermitido),
      kmAcumulado: Number(m.kmAcumulado),
      kmRestantes: Number(m.kmPermitido) > 0 ? Math.max(0, Number(m.kmPermitido) - Number(m.kmAcumulado)) : null,
      rendimientoEstandar: Number(m.rendimientoEstandar),
      porcentajeUso: getPorcentajeUso(m.kmAcumulado, m.kmPermitido),
      estadoMantenimiento: getMantenimientoStatus(m.kmAcumulado, m.kmPermitido),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/mantenimiento/:id/:componente/reset", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: componenteParamSchema }, req, res);
    if (!validated) return;

    const { id: vehiculoId, componente } = validated.params;

    const { vehiculo, error, status } = await requireVehiculoActivo(prisma, vehiculoId);
    if (error) return res.status(status).json({ error });

    if (vehiculo.tipo !== "PROPIO") {
      return res.status(422).json({ error: "El mantenimiento por km solo aplica a vehiculos propios." });
    }

    const existing = await prisma.mantenimientoKm.findUnique({
      where: { vehiculoId_componente: { vehiculoId, componente } },
    });

    if (!existing) {
      return res.status(404).json({ error: "Componente de mantenimiento no encontrado para este vehiculo." });
    }

    const kmAnterior = Number(existing.kmAcumulado);

    const m = await prisma.mantenimientoKm.update({
      where: { vehiculoId_componente: { vehiculoId, componente } },
      data: { kmAcumulado: 0 },
    });

    req.log.info("MantenimientoKm reseteado", { vehiculoId, componente, kmAnterior, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "MantenimientoKm",
      entityId: m.id,
      action: "reset",
      req,
      metadata: { vehiculoId, componente, kmAnterior },
    });

    res.json({
      componente,
      label: COMPONENTES_KM_LABELS[componente],
      kmPermitido: Number(m.kmPermitido),
      kmAcumulado: 0,
      kmRestantes: Number(m.kmPermitido) > 0 ? Number(m.kmPermitido) : null,
      rendimientoEstandar: Number(m.rendimientoEstandar),
      porcentajeUso: 0,
      estadoMantenimiento: getMantenimientoStatus(0, m.kmPermitido),
      message: "Kilometraje acumulado reseteado correctamente.",
    });
  } catch (err) {
    next(err);
  }
});

// ── Alertas combinadas ─────────────────────────────────────────────────────────

router.get("/alertas", async (req, res, next) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const en30Dias = new Date(hoy);
    en30Dias.setDate(en30Dias.getDate() + 30);

    const [docsAlerta, vehiculosMantenimiento] = await Promise.all([
      prisma.docVehiculo.findMany({
        where: {
          vehiculo: { estado: "ACTIVO" },
          fechaVencimiento: { lte: en30Dias },
        },
        include: { vehiculo: true },
        orderBy: { fechaVencimiento: "asc" },
      }),
      prisma.vehiculo.findMany({
        where: { estado: "ACTIVO", tipo: "PROPIO" },
        include: { mantenimientos: true },
      }),
    ]);

    const docs = docsAlerta.map((doc) => ({
      vehiculoId: doc.vehiculoId,
      placa: doc.vehiculo.placa,
      tipoDoc: doc.tipoDoc,
      label: TIPOS_DOC_LABELS[doc.tipoDoc] ?? doc.tipoDoc,
      fechaVencimiento: doc.fechaVencimiento,
      diasRestantes: getDiasRestantes(doc.fechaVencimiento),
      estadoDoc: getDocStatus(doc.fechaVencimiento),
    }));

    const mantenimientos = vehiculosMantenimiento
      .flatMap((v) =>
        v.mantenimientos
          .filter((m) => {
            const km = Number(m.kmPermitido ?? 0);
            if (km === 0) return false;
            return (Number(m.kmAcumulado ?? 0) / km) * 100 >= 80;
          })
          .map((m) => ({
            vehiculoId: v.id,
            placa: v.placa,
            componente: m.componente,
            label: COMPONENTES_KM_LABELS[m.componente] ?? m.componente,
            kmAcumulado: Number(m.kmAcumulado),
            kmPermitido: Number(m.kmPermitido),
            porcentajeUso: getPorcentajeUso(m.kmAcumulado, m.kmPermitido),
            estadoMantenimiento: getMantenimientoStatus(m.kmAcumulado, m.kmPermitido),
          })),
      )
      .sort((a, b) => b.porcentajeUso - a.porcentajeUso);

    res.json({ docs, mantenimientos });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
