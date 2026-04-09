/**
 * guias.js — Módulo de Guías de Remisión
 *
 * Rutas:
 *  GET    /api/guias                         Lista paginable con filtros
 *  GET    /api/guias/:id                     Detalle completo
 *  POST   /api/guias/importar                Importar XML/ZIP/PDF (multipart)
 *  PATCH  /api/guias/:id/vincular            Vincular a servicio
 *  PATCH  /api/guias/:id/estado              Actualizar estado
 *  PATCH  /api/guias/:id/observaciones       Actualizar observación interna
 *  GET    /api/guias/:id/sugerencias-servicio Servicios sugeridos para vincular
 *
 * Seguridad: authMiddleware + requireOperaciones en todo el router.
 */

const express = require("express");
const multer = require("multer");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireAdmin, requireOperaciones } = require("../middleware/rbac");
const { recordAuditEvent } = require("../lib/audit");
const { normalizePlaca, placasCoinciden } = require("../lib/normalizePlaca");
const { applyPaginationHeaders, resolvePagination } = require("../lib/pagination");
const { validate, validateRequest } = require("../lib/validate");
const {
  ESTADOS_GUIA,
  vincularGuiaSchema,
  patchEstadoGuiaSchema,
  patchObservacionesGuiaSchema,
  patchGuiaSchema,
} = require("../validators/guias.schema");
const {
  booleanQueryField,
  enumQueryField,
  idParamSchema,
  paginationQuerySchema,
  stringQueryField,
  uuidQueryField,
} = require("../validators/common.schema");
const { resolveImportFile, resolveZipXmlEntries } = require("../modules/guias/resolveImportFile");
const { parseXmlGuia } = require("../modules/guias/parseXmlGuia");
const { parsePdfGuia } = require("../modules/guias/parsePdfGuia");
const { normalizeSerieNumero } = require("../modules/guias/normalizeGuia");
const { buildGuiaChecklist } = require("../modules/guias/buildGuiaChecklist");

const router = express.Router();
router.use(authMiddleware);
router.use(requireOperaciones);

const guiaListQuerySchema = paginationQuerySchema.extend({
  estado: enumQueryField(ESTADOS_GUIA, "estado"),
  servicioId: uuidQueryField("servicioId"),
  sinVincular: booleanQueryField("sinVincular"),
  texto: stringQueryField("texto", { max: 120 }),
}).strict();

// ── Multer: memoria, máx 15 MB, solo XML/ZIP/PDF ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(xml|zip|pdf)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error("Formato no soportado. Sube un archivo .xml, .zip o .pdf."));
  },
});

const uploadMasivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xml|zip)$/i.test(file.originalname)) return cb(null, true);
    cb(new Error("Importacion masiva solo acepta archivos .xml o .zip con XML."));
  },
});

// ── Include estándar para queries ──────────────────────────────────────────────
const guiaInclude = {
  bienes: true,
  docsRelacionados: true,
  servicio: {
    include: {
      vehiculo: true,
      conductor: true,
      clientes: { include: { cliente: true } },
    },
  },
};

function buildGuiaCreateData(extracted, { origenImportacion, nombreArchivoOrigen }) {
  return {
    serie: extracted.serie,
    numero: extracted.numero,
    fechaEmision: new Date(extracted.fechaEmision),
    horaEmision: extracted.horaEmision ?? null,
    fechaInicioTraslado: extracted.fechaInicioTraslado
      ? new Date(extracted.fechaInicioTraslado)
      : null,
    puntoDeSalida: extracted.puntoDeSalida ?? null,
    puntoDeLlegada: extracted.puntoDeLlegada ?? null,
    remitenteNombre: extracted.remitenteNombre ?? null,
    remitenteRuc: extracted.remitenteRuc ?? null,
    destinatarioNombre: extracted.destinatarioNombre ?? null,
    destinatarioRuc: extracted.destinatarioRuc ?? null,
    pagadorFleteNombre: extracted.pagadorFleteNombre ?? null,
    pagadorFleteRuc: extracted.pagadorFleteRuc ?? null,
    transportistaNombre: extracted.transportistaNombre ?? null,
    transportistaRuc: extracted.transportistaRuc ?? null,
    placaPrincipal: extracted.placaPrincipal ?? null,
    placaSecundaria: extracted.placaSecundaria ?? null,
    conductorPrincipalNombre: extracted.conductorPrincipalNombre ?? null,
    conductorPrincipalDocumento: extracted.conductorPrincipalDocumento ?? null,
    conductorPrincipalLicencia: extracted.conductorPrincipalLicencia ?? null,
    pesoBrutoTotal: extracted.pesoBrutoTotal ?? null,
    unidadPeso: extracted.unidadPeso ?? null,
    mtcNumero: extracted.mtcNumero ?? null,
    subcontratistaNombre: extracted.subcontratistaNombre ?? null,
    subcontratistaRuc: extracted.subcontratistaRuc ?? null,
    transbordo: extracted.transbordo ?? false,
    retornoVacio: extracted.retornoVacio ?? false,
    subcontratado: extracted.subcontratado ?? false,
    observacionSunat: extracted.observacionSunat ?? null,
    origenImportacion,
    nombreArchivoOrigen,
    rawPayload: extracted,
    estado: "EMITIDA",
    servicioId: null,
    bienes: {
      create: (extracted.bienes ?? []).map((bien) => ({
        descripcion: bien.descripcion,
        cantidad: bien.cantidad ?? null,
        unidadMedida: bien.unidadMedida ?? null,
      })),
    },
    docsRelacionados: {
      create: (extracted.docsRelacionados ?? []).map((doc) => ({
        tipoDocumentoCode: doc.tipoDocumentoCode ?? null,
        tipoDocumento: doc.tipoDocumento ?? "DOCUMENTO",
        numeroDocumento: doc.numeroDocumento,
        rucEmisor: doc.rucEmisor ?? null,
      })),
    },
  };
}

async function existeVehiculoEnFlotaPorPlacas(placas = []) {
  const placasNormalizadas = placas.map((placa) => normalizePlaca(placa)).filter(Boolean);
  if (placasNormalizadas.length === 0) return false;

  const vehiculos = await prisma.vehiculo.findMany({
    select: { placa: true, placaCarreta: true },
  });

  return vehiculos.some((vehiculo) =>
    placasNormalizadas.some(
      (placa) => placasCoinciden(vehiculo.placa, placa) || placasCoinciden(vehiculo.placaCarreta, placa),
    ),
  );
}

async function importarUnaGuiaXml(buffer, filename) {
  let extracted;
  try {
    extracted = parseXmlGuia(buffer);
  } catch (err) {
    return { ok: false, error: err.message, filename };
  }

  const { serie, numero } = normalizeSerieNumero(extracted.idCompleto);

  if (!serie || !numero) {
    return {
      ok: false,
      error: "No se pudo determinar la serie y numero de la guia desde el XML.",
      filename,
    };
  }

  if (!extracted.fechaEmision) {
    return {
      ok: false,
      error: "No se pudo determinar la fecha de emision de la guia.",
      filename,
    };
  }

  const existing = await prisma.guiaRemision.findUnique({
    where: { serie_numero: { serie, numero } },
    select: { id: true },
  });

  if (existing) {
    return {
      ok: false,
      duplicado: true,
      error: `Guía ${serie}-${numero} ya existe.`,
      filename,
      guiaId: existing.id,
    };
  }

  try {
    const created = await prisma.guiaRemision.create({
      data: buildGuiaCreateData(
        { ...extracted, serie, numero },
        { origenImportacion: "XML", nombreArchivoOrigen: filename },
      ),
      include: guiaInclude,
    });

    return {
      ok: true,
      filename,
      serie,
      numero,
      guiaId: created.id,
    };
  } catch (err) {
    if (err?.code === "P2002") {
      const duplicate = await prisma.guiaRemision.findUnique({
        where: { serie_numero: { serie, numero } },
        select: { id: true },
      });

      return {
        ok: false,
        duplicado: true,
        error: `Guía ${serie}-${numero} ya existe.`,
        filename,
        guiaId: duplicate?.id ?? null,
      };
    }

    throw err;
  }
}

// ── GET /api/guias ─────────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: guiaListQuerySchema }, req, res);
    if (!validated) return;

    const { estado, servicioId, sinVincular, texto } = validated.query;
    const pagination = resolvePagination(validated.query, { defaultLimit: 100, maxLimit: 100 });

    const where = {};

    if (estado) where.estado = estado;
    if (servicioId) where.servicioId = servicioId;
    if (sinVincular) where.servicioId = null;

    if (texto) {
      const q = texto.trim();
      where.OR = [
        { serie: { contains: q, mode: "insensitive" } },
        { numero: { contains: q, mode: "insensitive" } },
        { placaPrincipal: { contains: q, mode: "insensitive" } },
        { placaSecundaria: { contains: q, mode: "insensitive" } },
        { remitenteNombre: { contains: q, mode: "insensitive" } },
        { destinatarioNombre: { contains: q, mode: "insensitive" } },
        {
          docsRelacionados: {
            some: { numeroDocumento: { contains: q, mode: "insensitive" } },
          },
        },
      ];
    }

    const [total, guias] = await Promise.all([
      prisma.guiaRemision.count({ where }),
      prisma.guiaRemision.findMany({
        where,
        select: {
          id: true,
          serie: true,
          numero: true,
          fechaEmision: true,
          estado: true,
          servicioId: true,
          placaPrincipal: true,
          placaSecundaria: true,
          puntoDeSalida: true,
          puntoDeLlegada: true,
          remitenteNombre: true,
          destinatarioNombre: true,
          createdAt: true,
          servicio: {
            select: {
              id: true,
              origen: true,
              destino: true,
              vehiculo: { select: { placa: true } },
            },
          },
        },
        orderBy: [{ fechaEmision: "desc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    const result = guias.map((g) => ({
      ...g,
      numeroCompleto: `${g.serie}-${g.numero}`,
    }));

    applyPaginationHeaders(res, { ...pagination, total });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/guias/:id ─────────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: validated.params.id },
      include: guiaInclude,
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });
    res.json({ ...guia, numeroCompleto: `${guia.serie}-${guia.numero}` });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/guias/importar ────────────────────────────────────────────────────
router.post("/importar", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió ningún archivo." });
    }

    const { buffer, originalname } = req.file;

    // 1. Resolver tipo de archivo (XML/ZIP→XML / ZIP→PDF / PDF)
    let resolved;
    try {
      resolved = resolveImportFile(buffer, originalname);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // 2. Parsear según tipo
    let extracted;
    try {
      if (resolved.type === "XML") {
        extracted = parseXmlGuia(resolved.buffer);
      } else {
        extracted = await parsePdfGuia(resolved.buffer);
      }
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }

    // 3. Normalizar serie/numero
    const { serie, numero } = normalizeSerieNumero(extracted.idCompleto);

    if (!serie || !numero) {
      return res.status(422).json({
        error:
          "No se pudo determinar la serie y número de la guía desde el archivo.",
        warnings: extracted.warnings,
      });
    }

    if (!extracted.fechaEmision) {
      return res.status(422).json({
        error: "No se pudo determinar la fecha de emisión de la guía.",
        warnings: extracted.warnings,
      });
    }

    // 4. Verificar duplicado
    const existing = await prisma.guiaRemision.findUnique({
      where: { serie_numero: { serie, numero } },
    });
    if (existing) {
      return res.status(409).json({
        error: `La guía ${serie}-${numero} ya existe en el sistema.`,
        guiaExistenteId: existing.id,
      });
    }

    // 5. Verificar si la placa está en flota (informativo, no bloquea)
    const vehiculoEnFlota = await existeVehiculoEnFlotaPorPlacas([
      extracted.placaPrincipal,
      extracted.placaSecundaria,
    ]);

    // 6. Guardar en transacción
    const guia = await prisma.$transaction(async (tx) => {
      const created = await tx.guiaRemision.create({
        data: buildGuiaCreateData(
          { ...extracted, serie, numero },
          { origenImportacion: resolved.sourceType, nombreArchivoOrigen: resolved.filename },
        ),
        include: guiaInclude,
      });
      return created;
    });

    req.log.info("Guía importada", {
      guiaId: guia.id,
      serie,
      numero,
      sourceType: resolved.sourceType,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "GuiaRemision",
      entityId: guia.id,
      action: "import",
      req,
      metadata: { serie, numero, sourceType: resolved.sourceType },
    });

    // 7. Construir checklist
    const checklist = buildGuiaChecklist({
      extractedData: { ...extracted, serie, numero, origenImportacion: resolved.sourceType },
      vehiculoEnFlota,
    });

    res.status(201).json({
      guia: { ...guia, numeroCompleto: `${guia.serie}-${guia.numero}` },
      extractedData: extracted,
      checklist,
      warnings: checklist.warnings,
      sourceType: resolved.sourceType,
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/guias/:id/vincular ──────────────────────────────────────────────
router.post("/importar-masivo", uploadMasivo.array("files", 50), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No se recibieron archivos." });
    }

    const xmlEntries = [];
    const detalle = [];

    for (const file of req.files) {
      const ext = file.originalname.split(".").pop().toLowerCase();

      if (ext === "xml") {
        xmlEntries.push({ buffer: file.buffer, filename: file.originalname });
        continue;
      }

      if (ext === "zip") {
        try {
          const entries = resolveZipXmlEntries(file.buffer, file.originalname);
          xmlEntries.push(...entries);
        } catch (err) {
          detalle.push({
            filename: file.originalname,
            estado: "error",
            mensaje: err.message,
          });
        }
      }
    }

    if (xmlEntries.length === 0) {
      return res.status(400).json({
        error: detalle[0]?.mensaje || "No se encontraron archivos XML validos en la carga.",
      });
    }

    const totalRecibidos = xmlEntries.length;
    let importados = 0;
    let duplicados = 0;
    let fallidos = detalle.length;

    for (const entry of xmlEntries) {
      try {
        const result = await importarUnaGuiaXml(entry.buffer, entry.filename);

        if (result.ok) {
          importados++;
          detalle.push({
            filename: result.filename,
            estado: "importado",
            mensaje: `Guía ${result.serie}-${result.numero} importada correctamente.`,
            serie: result.serie,
            numero: result.numero,
            guiaId: result.guiaId,
          });
          continue;
        }

        if (result.duplicado) {
          duplicados++;
          detalle.push({
            filename: result.filename,
            estado: "duplicado",
            mensaje: result.error,
            guiaId: result.guiaId ?? null,
          });
          continue;
        }

        fallidos++;
        detalle.push({
          filename: result.filename,
          estado: "error",
          mensaje: result.error || "No se pudo procesar el XML.",
        });
      } catch (err) {
        fallidos++;
        req.log.error("Error en importacion masiva de guia", {
          filename: entry.filename,
          error: err.message,
          usuarioId: req.user.id,
        });
        detalle.push({
          filename: entry.filename,
          estado: "error",
          mensaje: "Error interno al procesar el archivo.",
        });
      }
    }

    req.log.info("Importacion masiva de guias completada", {
      totalRecibidos,
      importados,
      duplicados,
      fallidos,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "GuiaRemisionImport",
      entityId: "bulk",
      action: "bulk_import",
      req,
      metadata: { totalRecibidos, importados, duplicados, fallidos },
    });

    res.json({
      message: "Importación masiva completada.",
      totalRecibidos,
      importados,
      duplicados,
      fallidos,
      detalle,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(patchGuiaSchema, req.body, res);
    if (!body) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: validated.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    const updated = await prisma.guiaRemision.update({
      where: { id: validated.params.id },
      data: {
        ...(body.estado !== undefined && { estado: body.estado }),
        ...(body.observaciones !== undefined && { observaciones: body.observaciones }),
        ...(body.fechaRecepcion !== undefined && {
          fechaRecepcion: body.fechaRecepcion ? new Date(body.fechaRecepcion) : null,
        }),
      },
      include: guiaInclude,
    });

    req.log.info("Guía actualizada", {
      guiaId: validated.params.id,
      usuarioId: req.user.id,
      cambios: {
        ...(body.estado !== undefined && { estado: body.estado }),
        ...(body.observaciones !== undefined && { observaciones: true }),
        ...(body.fechaRecepcion !== undefined && { fechaRecepcion: body.fechaRecepcion }),
      },
    });
    await recordAuditEvent({
      entityType: "GuiaRemision",
      entityId: updated.id,
      action: "update",
      req,
      metadata: { campos: Object.keys(body) },
    });

    res.json({
      ...updated,
      numeroCompleto: `${updated.serie}-${updated.numero}`,
      message: "Cambios guardados correctamente",
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/guias/:id/vincular
router.patch("/:id/vincular", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(vincularGuiaSchema, req.body, res);
    if (!body) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: validated.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    const servicio = await prisma.servicio.findUnique({
      where: { id: body.servicioId },
    });
    if (!servicio) return res.status(404).json({ error: "Servicio no encontrado." });

    const updated = await prisma.guiaRemision.update({
      where: { id: validated.params.id },
      data: {
        servicioId: body.servicioId,
        ...(body.observaciones !== undefined && {
          observaciones: body.observaciones,
        }),
      },
      include: guiaInclude,
    });

    req.log.info("Guía vinculada a servicio", {
      guiaId: validated.params.id,
      servicioId: body.servicioId,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "GuiaRemision",
      entityId: updated.id,
      action: "link_service",
      req,
      metadata: { servicioId: body.servicioId },
    });

    res.json({
      ...updated,
      numeroCompleto: `${updated.serie}-${updated.numero}`,
      message: "La guía fue vinculada correctamente al servicio",
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/guias/:id/estado ────────────────────────────────────────────────
// PATCH /api/guias/:id/desvincular
router.patch("/:id/desvincular", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: validated.params.id },
      include: guiaInclude,
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    if (!guia.servicioId) {
      return res.json({
        ...guia,
        numeroCompleto: `${guia.serie}-${guia.numero}`,
        message: "La guía ya no tiene un servicio vinculado.",
      });
    }

    const updated = await prisma.guiaRemision.update({
      where: { id: validated.params.id },
      data: { servicioId: null },
      include: guiaInclude,
    });

    req.log.info("Guía desvinculada de servicio", {
      guiaId: validated.params.id,
      servicioIdAnterior: guia.servicioId,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "GuiaRemision",
      entityId: updated.id,
      action: "unlink_service",
      req,
      metadata: { servicioIdAnterior: guia.servicioId },
    });

    res.json({
      ...updated,
      numeroCompleto: `${updated.serie}-${updated.numero}`,
      message: "La guía fue desvinculada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/guias/:id/estado
router.patch("/:id/estado", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(patchEstadoGuiaSchema, req.body, res);
    if (!body) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: validated.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    const updated = await prisma.guiaRemision.update({
      where: { id: validated.params.id },
      data: { estado: body.estado },
      include: guiaInclude,
    });

    req.log.info("Estado de guía actualizado", {
      guiaId: validated.params.id,
      estadoAnterior: guia.estado,
      estadoNuevo: body.estado,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "GuiaRemision",
      entityId: updated.id,
      action: "status_change",
      req,
      metadata: { estadoAnterior: guia.estado, estadoNuevo: body.estado },
    });

    res.json({ ...updated, numeroCompleto: `${updated.serie}-${updated.numero}` });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/guias/:id/observaciones ────────────────────────────────────────
router.patch("/:id/observaciones", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(patchObservacionesGuiaSchema, req.body, res);
    if (!body) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: validated.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    const updated = await prisma.guiaRemision.update({
      where: { id: validated.params.id },
      data: { observaciones: body.observaciones },
    });

    await recordAuditEvent({
      entityType: "GuiaRemision",
      entityId: updated.id,
      action: "update_notes",
      req,
      metadata: { observaciones: true },
    });

    res.json({ id: updated.id, observaciones: updated.observaciones });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/guias/:id/sugerencias-servicio ────────────────────────────────────
// DELETE /api/guias/:id
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: validated.params.id },
      select: { id: true, serie: true, numero: true },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    await prisma.$transaction(async (tx) => {
      await tx.guiaBien.deleteMany({
        where: { guiaRemisionId: validated.params.id },
      });

      await tx.guiaDocRelacionado.deleteMany({
        where: { guiaRemisionId: validated.params.id },
      });

      await tx.guiaRemision.delete({
        where: { id: validated.params.id },
      });
    });

    req.log.info("Guía eliminada", {
      guiaId: validated.params.id,
      serie: guia.serie,
      numero: guia.numero,
      usuarioId: req.user.id,
    });
    await recordAuditEvent({
      entityType: "GuiaRemision",
      entityId: guia.id,
      action: "delete",
      req,
      metadata: { serie: guia.serie, numero: guia.numero },
    });

    res.json({
      ok: true,
      id: validated.params.id,
      message: "La guía fue eliminada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/guias/:id/sugerencias-servicio
router.get("/:id/sugerencias-servicio", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: validated.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    // Buscar servicios candidatos: sin guía vinculada con esta serie-numero,
    // en un rango de ±14 días alrededor de la fechaEmision
    const fechaBase = guia.fechaEmision ?? new Date();
    const desde = new Date(fechaBase);
    const hasta = new Date(fechaBase);
    desde.setDate(desde.getDate() - 14);
    hasta.setDate(hasta.getDate() + 14);

    const servicios = await prisma.servicio.findMany({
      where: {
        fechaServicio: { gte: desde, lte: hasta },
      },
      include: {
        vehiculo: true,
        conductor: true,
        clientes: { include: { cliente: true } },
      },
      orderBy: { fechaServicio: "desc" },
      take: 50,
    });

    // Función de score
    function score(servicio) {
      let pts = 0;
      const razones = [];

      // Placa principal
      if (placasCoinciden(servicio.vehiculo?.placa, guia.placaPrincipal)) {
        pts += 40;
        razones.push("Misma placa");
      }

      // Fecha cercana
      if (servicio.fechaServicio && guia.fechaEmision) {
        const diff =
          Math.abs(
            new Date(servicio.fechaServicio).getTime() -
              new Date(guia.fechaEmision).getTime()
          ) /
          (1000 * 60 * 60 * 24);
        if (diff < 1) { pts += 25; razones.push("Misma fecha"); }
        else if (diff <= 2) { pts += 18; razones.push("Fecha muy cercana"); }
        else if (diff <= 5) { pts += 10; razones.push("Fecha cercana"); }
        else if (diff <= 14) { pts += 3; razones.push("Fecha próxima"); }
      }

      // Origen/destino similar
      const guiaOrigen = (guia.puntoDeSalida ?? "").toLowerCase();
      const guiaDestino = (guia.puntoDeLlegada ?? "").toLowerCase();
      const svcOrigen = (servicio.origen ?? "").toLowerCase();
      const svcDestino = (servicio.destino ?? "").toLowerCase();

      if (guiaOrigen && svcOrigen) {
        const words = svcOrigen.split(/\s+/).filter((w) => w.length > 3);
        if (words.some((w) => guiaOrigen.includes(w))) {
          pts += 10;
          razones.push("Origen similar");
        }
      }
      if (guiaDestino && svcDestino) {
        const words = svcDestino.split(/\s+/).filter((w) => w.length > 3);
        if (words.some((w) => guiaDestino.includes(w))) {
          pts += 10;
          razones.push("Destino similar");
        }
      }

      // Clientes relacionados
      const clienteRucs = (servicio.clientes ?? []).map((sc) => sc.cliente?.ruc).filter(Boolean);
      if (guia.remitenteRuc && clienteRucs.includes(guia.remitenteRuc)) {
        pts += 15;
        razones.push("Remitente coincide con cliente");
      }
      if (guia.destinatarioRuc && clienteRucs.includes(guia.destinatarioRuc)) {
        pts += 15;
        razones.push("Destinatario coincide con cliente");
      }
      if (guia.pagadorFleteRuc && clienteRucs.includes(guia.pagadorFleteRuc)) {
        pts += 15;
        razones.push("Pagador coincide con cliente");
      }

      return { score: pts, razones };
    }

    const sugerencias = servicios
      .map((s) => {
        const { score: pts, razones } = score(s);
        const cond = s.conductor;
        return {
          id: s.id,
          fechaServicio: s.fechaServicio,
          origen: s.origen,
          destino: s.destino,
          estado: s.estado,
          vehiculo: s.vehiculo
            ? { id: s.vehiculo.id, placa: s.vehiculo.placa, tipoUnidad: s.vehiculo.tipoUnidad }
            : null,
          conductor: cond
            ? {
                id: cond.id,
                nombre: `${cond.nombre} ${cond.apPaterno}`.trim(),
                nroDocumento: cond.nroDocumento,
              }
            : null,
          clientes: (s.clientes ?? []).map((sc) => ({
            id: sc.cliente.id,
            razonSocial: sc.cliente.razonSocial,
            ruc: sc.cliente.ruc,
          })),
          score: pts,
          razones,
        };
      })
      .filter((s) => s.score > 0 || servicios.length < 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    res.json(sugerencias);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
