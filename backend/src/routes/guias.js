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
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const logger = require("../lib/logger");
const { validate } = require("../lib/validate");
const {
  vincularGuiaSchema,
  patchEstadoGuiaSchema,
  patchObservacionesGuiaSchema,
  patchGuiaSchema,
} = require("../validators/guias.schema");
const { resolveImportFile } = require("../modules/guias/resolveImportFile");
const { parseXmlGuia } = require("../modules/guias/parseXmlGuia");
const { parsePdfGuia } = require("../modules/guias/parsePdfGuia");
const { normalizeSerieNumero } = require("../modules/guias/normalizeGuia");
const { buildGuiaChecklist } = require("../modules/guias/buildGuiaChecklist");

const router = express.Router();
router.use(authMiddleware);
router.use(requireOperaciones);

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

// ── GET /api/guias ─────────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { estado, servicioId, sinVincular, texto } = req.query;

    const where = {};

    if (estado) where.estado = estado;
    if (servicioId) where.servicioId = servicioId;
    if (sinVincular === "true") where.servicioId = null;

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

    const guias = await prisma.guiaRemision.findMany({
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
    });

    const result = guias.map((g) => ({
      ...g,
      numeroCompleto: `${g.serie}-${g.numero}`,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/guias/:id ─────────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const guia = await prisma.guiaRemision.findUnique({
      where: { id: req.params.id },
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
    let vehiculoEnFlota = false;
    if (extracted.placaPrincipal) {
      const veh = await prisma.vehiculo.findUnique({
        where: { placa: extracted.placaPrincipal },
        select: { id: true },
      });
      vehiculoEnFlota = !!veh;
    }

    // 6. Guardar en transacción
    const guia = await prisma.$transaction(async (tx) => {
      const created = await tx.guiaRemision.create({
        data: {
          serie,
          numero,
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
          origenImportacion: resolved.sourceType,
          nombreArchivoOrigen: resolved.filename,
          rawPayload: extracted,
          estado: "EMITIDA",
          servicioId: null,
          bienes: {
            create: (extracted.bienes ?? []).map((b) => ({
              descripcion: b.descripcion,
              cantidad: b.cantidad ?? null,
              unidadMedida: b.unidadMedida ?? null,
            })),
          },
          docsRelacionados: {
            create: (extracted.docsRelacionados ?? []).map((d) => ({
              tipoDocumentoCode: d.tipoDocumentoCode ?? null,
              tipoDocumento: d.tipoDocumento ?? "DOCUMENTO",
              numeroDocumento: d.numeroDocumento,
              rucEmisor: d.rucEmisor ?? null,
            })),
          },
        },
        include: guiaInclude,
      });
      return created;
    });

    logger.info("Guía importada", {
      guiaId: guia.id,
      serie,
      numero,
      sourceType: resolved.sourceType,
      usuarioId: req.user.id,
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
router.patch("/:id", async (req, res, next) => {
  try {
    const body = validate(patchGuiaSchema, req.body, res);
    if (!body) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: req.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    const updated = await prisma.guiaRemision.update({
      where: { id: req.params.id },
      data: {
        ...(body.estado !== undefined && { estado: body.estado }),
        ...(body.observaciones !== undefined && { observaciones: body.observaciones }),
        ...(body.fechaRecepcion !== undefined && {
          fechaRecepcion: body.fechaRecepcion ? new Date(body.fechaRecepcion) : null,
        }),
      },
      include: guiaInclude,
    });

    logger.info("Guía actualizada", {
      guiaId: req.params.id,
      usuarioId: req.user.id,
      cambios: {
        ...(body.estado !== undefined && { estado: body.estado }),
        ...(body.observaciones !== undefined && { observaciones: true }),
        ...(body.fechaRecepcion !== undefined && { fechaRecepcion: body.fechaRecepcion }),
      },
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
    const body = validate(vincularGuiaSchema, req.body, res);
    if (!body) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: req.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    const servicio = await prisma.servicio.findUnique({
      where: { id: body.servicioId },
    });
    if (!servicio) return res.status(404).json({ error: "Servicio no encontrado." });

    const updated = await prisma.guiaRemision.update({
      where: { id: req.params.id },
      data: {
        servicioId: body.servicioId,
        ...(body.observaciones !== undefined && {
          observaciones: body.observaciones,
        }),
      },
      include: guiaInclude,
    });

    logger.info("Guía vinculada a servicio", {
      guiaId: req.params.id,
      servicioId: body.servicioId,
      usuarioId: req.user.id,
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
    const guia = await prisma.guiaRemision.findUnique({
      where: { id: req.params.id },
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
      where: { id: req.params.id },
      data: { servicioId: null },
      include: guiaInclude,
    });

    logger.info("Guía desvinculada de servicio", {
      guiaId: req.params.id,
      servicioIdAnterior: guia.servicioId,
      usuarioId: req.user.id,
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
    const body = validate(patchEstadoGuiaSchema, req.body, res);
    if (!body) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: req.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    const updated = await prisma.guiaRemision.update({
      where: { id: req.params.id },
      data: { estado: body.estado },
      include: guiaInclude,
    });

    logger.info("Estado de guía actualizado", {
      guiaId: req.params.id,
      estadoAnterior: guia.estado,
      estadoNuevo: body.estado,
      usuarioId: req.user.id,
    });

    res.json({ ...updated, numeroCompleto: `${updated.serie}-${updated.numero}` });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/guias/:id/observaciones ────────────────────────────────────────
router.patch("/:id/observaciones", async (req, res, next) => {
  try {
    const body = validate(patchObservacionesGuiaSchema, req.body, res);
    if (!body) return;

    const guia = await prisma.guiaRemision.findUnique({
      where: { id: req.params.id },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    const updated = await prisma.guiaRemision.update({
      where: { id: req.params.id },
      data: { observaciones: body.observaciones },
    });

    res.json({ id: updated.id, observaciones: updated.observaciones });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/guias/:id/sugerencias-servicio ────────────────────────────────────
// DELETE /api/guias/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const guia = await prisma.guiaRemision.findUnique({
      where: { id: req.params.id },
      select: { id: true, serie: true, numero: true },
    });
    if (!guia) return res.status(404).json({ error: "Guía no encontrada." });

    await prisma.$transaction(async (tx) => {
      await tx.guiaBien.deleteMany({
        where: { guiaRemisionId: req.params.id },
      });

      await tx.guiaDocRelacionado.deleteMany({
        where: { guiaRemisionId: req.params.id },
      });

      await tx.guiaRemision.delete({
        where: { id: req.params.id },
      });
    });

    logger.info("Guía eliminada", {
      guiaId: req.params.id,
      serie: guia.serie,
      numero: guia.numero,
      usuarioId: req.user.id,
    });

    res.json({
      ok: true,
      id: req.params.id,
      message: "La guía fue eliminada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/guias/:id/sugerencias-servicio
router.get("/:id/sugerencias-servicio", async (req, res, next) => {
  try {
    const guia = await prisma.guiaRemision.findUnique({
      where: { id: req.params.id },
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
      if (
        guia.placaPrincipal &&
        servicio.vehiculo?.placa?.toUpperCase() === guia.placaPrincipal.toUpperCase()
      ) {
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
