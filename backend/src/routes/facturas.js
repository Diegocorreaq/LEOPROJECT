/**
 * facturas.js — Módulo de Facturación
 *
 * Rutas:
 *  GET    /api/facturas                           Lista con filtros
 *  GET    /api/facturas/servicios-disponibles     Buscador manual de servicios
 *  GET    /api/facturas/:id                       Detalle completo
 *  GET    /api/facturas/:id/sugerencias-servicio  Servicios candidatos con score
 *  POST   /api/facturas/importar                  Importar XML/ZIP/PDF individual
 *  POST   /api/facturas/importar-masivo           Importar múltiples XML o ZIP con XML
 *  PATCH  /api/facturas/:id                       Edición básica
 *  PATCH  /api/facturas/:id/vincular              Vincular a servicio
 *  PATCH  /api/facturas/:id/desvincular           Desvincular de servicio
 *  DELETE /api/facturas/:id                       Eliminar factura
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
const { patchFacturaSchema, vincularFacturaSchema } = require("../validators/facturas.schema");
const { resolveImportFile, resolveZipXmlEntries } = require("../modules/facturas/resolveImportFile");
const { parseXmlFactura } = require("../modules/facturas/parseXmlFactura");
const { parsePdfFactura } = require("../modules/facturas/parsePdfFactura");
const { buildFacturaChecklist } = require("../modules/facturas/buildFacturaChecklist");

const router = express.Router();
router.use(authMiddleware);
router.use(requireOperaciones);

// ── Multer: memoria, máx 30 MB (masivo), solo XML/ZIP/PDF ─────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xml|zip|pdf)$/i.test(file.originalname)) return cb(null, true);
    cb(new Error("Formato no soportado. Sube un archivo .xml, .zip o .pdf."));
  },
});

const uploadMasivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xml|zip)$/i.test(file.originalname)) return cb(null, true);
    cb(new Error("Importación masiva solo acepta archivos .xml o .zip con XML."));
  },
});

// ── Include estándar ───────────────────────────────────────────────────────────
const facturaInclude = {
  cliente: true,
  ordenServicio: {
    include: {
      servicio: {
        include: {
          vehiculo: true,
          conductor: true,
          clientes: { include: { cliente: true } },
        },
      },
    },
  },
  guias: true,
  pagos: true,
};

// ── Helper: resolver/crear cliente por RUC ────────────────────────────────────
async function resolveOrCreateCliente(tx, { clienteRuc, clienteNombre }) {
  if (!clienteRuc && !clienteNombre) return null;

  if (clienteRuc) {
    const existing = await tx.cliente.findUnique({ where: { ruc: clienteRuc } });
    if (existing) return existing;

    if (clienteNombre) {
      return tx.cliente.create({
        data: { ruc: clienteRuc, razonSocial: clienteNombre },
      });
    }
    // Tenemos RUC pero no nombre → no podemos crear con datos confiables
    return null;
  }

  // Sin RUC, solo nombre → no se puede crear cliente de forma confiable
  return null;
}

// ── Helper: buscar/crear OrdenServicio para un servicio ───────────────────────
async function resolveOrCreateOrden(tx, servicio, montos) {
  const existingOrden = await tx.ordenServicio.findUnique({
    where: { servicioId: servicio.id },
  });

  if (existingOrden) return existingOrden;

  return tx.ordenServicio.create({
    data: {
      servicioId: servicio.id,
      fleteNeto: montos.montoNeto ?? 0,
      igv: montos.igv ?? 0,
      total: montos.total ?? 0,
      detraccion: montos.detraccionMonto ?? 0,
      estado: "PENDIENTE",
    },
  });
}

// ── Helper: insertar FacturaGuia evitando duplicados ──────────────────────────
async function insertGuiasRelacionadas(tx, facturaId, guiasRelacionadas) {
  if (!Array.isArray(guiasRelacionadas) || guiasRelacionadas.length === 0) return;

  for (const g of guiasRelacionadas) {
    if (!g.serieGuia || !g.numeroGuia) continue;
    try {
      await tx.facturaGuia.create({
        data: { facturaId, serieGuia: g.serieGuia, numeroGuia: g.numeroGuia },
      });
    } catch (err) {
      // P2002 = unique constraint → duplicado, se omite silenciosamente
      if (err?.code !== "P2002") throw err;
    }
  }
}

// ── Helper: importar un XML individual (reutilizable en masivo) ───────────────
async function importarUnXml(buffer, filename) {
  let extracted;
  try {
    extracted = parseXmlFactura(buffer);
  } catch (err) {
    return { ok: false, error: err.message, filename };
  }

  const { serie, numero } = extracted;

  // Verificar duplicado
  const existing = await prisma.factura.findUnique({
    where: { serie_numero: { serie, numero } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, duplicado: true, error: `Factura ${serie}-${numero} ya existe.`, filename, facturaId: existing.id };
  }

  // Resolver cliente
  let cliente = null;
  try {
    cliente = await prisma.$transaction((tx) =>
      resolveOrCreateCliente(tx, {
        clienteRuc: extracted.clienteRuc,
        clienteNombre: extracted.clienteNombre,
      })
    );
  } catch {
    return { ok: false, error: "Error al resolver/crear el cliente.", filename };
  }

  if (!cliente) {
    return {
      ok: false,
      error: `No se pudo resolver el cliente (RUC: ${extracted.clienteRuc ?? "N/A"}, Nombre: ${extracted.clienteNombre ?? "N/A"}).`,
      filename,
    };
  }

  // Guardar en transacción
  let factura;
  try {
    factura = await prisma.$transaction(async (tx) => {
      const created = await tx.factura.create({
        data: {
          clienteId: cliente.id,
          serie,
          numero,
          tipo: extracted.tipo ?? "FACTURA",
          fechaEmision: new Date(extracted.fechaEmision),
          fechaVencimiento: extracted.fechaVencimiento ? new Date(extracted.fechaVencimiento) : null,
          moneda: extracted.moneda ?? "PEN",
          montoNeto: extracted.montoNeto ?? 0,
          igv: extracted.igv ?? 0,
          total: extracted.total ?? 0,
          detraccionPorcentaje: extracted.detraccionPorcentaje ?? 0,
          detraccionMonto: extracted.detraccionMonto ?? 0,
          formaPago: extracted.formaPago ?? null,
          origenImportacion: "XML",
          nombreArchivoOrigen: filename,
          rawPayload: extracted,
          estadoPago: "PENDIENTE",
        },
      });

      await insertGuiasRelacionadas(tx, created.id, extracted.guiasRelacionadas);

      return created;
    });
  } catch (err) {
    if (err?.code === "P2002") {
      return { ok: false, duplicado: true, error: `Factura ${serie}-${numero} ya existe (race condition).`, filename };
    }
    throw err;
  }

  return { ok: true, filename, serie, numero, facturaId: factura.id };
}

// ── GET /api/facturas ──────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const { texto, estadoPago, sinVincular, clienteId, desde, hasta } = req.query;

    const where = {};

    if (estadoPago) where.estadoPago = estadoPago;
    if (clienteId) where.clienteId = clienteId;
    if (sinVincular === "true") where.ordenServicioId = null;

    if (desde || hasta) {
      where.fechaEmision = {};
      if (desde) where.fechaEmision.gte = new Date(desde);
      if (hasta) where.fechaEmision.lte = new Date(hasta);
    }

    if (texto) {
      const q = texto.trim();
      where.OR = [
        { serie: { contains: q, mode: "insensitive" } },
        { numero: { contains: q, mode: "insensitive" } },
        { cliente: { razonSocial: { contains: q, mode: "insensitive" } } },
        { cliente: { ruc: { contains: q, mode: "insensitive" } } },
        {
          guias: {
            some: {
              OR: [
                { serieGuia: { contains: q, mode: "insensitive" } },
                { numeroGuia: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const facturas = await prisma.factura.findMany({
      where,
      select: {
        id: true,
        serie: true,
        numero: true,
        tipo: true,
        fechaEmision: true,
        total: true,
        estadoPago: true,
        ordenServicioId: true,
        origenImportacion: true,
        cliente: { select: { id: true, razonSocial: true, ruc: true } },
        ordenServicio: {
          select: {
            id: true,
            servicio: { select: { id: true, origen: true, destino: true } },
          },
        },
        _count: { select: { guias: true } },
      },
      orderBy: [{ fechaEmision: "desc" }, { createdAt: "desc" }],
    });

    const result = facturas.map((f) => ({
      ...f,
      numeroCompleto: `${f.serie}-${f.numero}`,
      cantidadGuias: f._count.guias,
      _count: undefined,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/facturas/servicios-disponibles ────────────────────────────────────
router.get("/servicios-disponibles", async (req, res, next) => {
  try {
    const { texto } = req.query;

    const where = {};
    if (texto) {
      const q = texto.trim();
      where.OR = [
        { origen: { contains: q, mode: "insensitive" } },
        { destino: { contains: q, mode: "insensitive" } },
        { vehiculo: { placa: { contains: q, mode: "insensitive" } } },
        { clientes: { some: { cliente: { razonSocial: { contains: q, mode: "insensitive" } } } } },
      ];
    }

    const servicios = await prisma.servicio.findMany({
      where,
      include: {
        vehiculo: true,
        conductor: true,
        clientes: { include: { cliente: true } },
        orden: true,
      },
      orderBy: { fechaServicio: "desc" },
      take: 50,
    });

    res.json(
      servicios.map((s) => ({
        id: s.id,
        fechaServicio: s.fechaServicio,
        origen: s.origen,
        destino: s.destino,
        estado: s.estado,
        vehiculo: s.vehiculo ? { id: s.vehiculo.id, placa: s.vehiculo.placa } : null,
        conductor: s.conductor
          ? {
              id: s.conductor.id,
              nombre: `${s.conductor.nombre} ${s.conductor.apPaterno}`.trim(),
            }
          : null,
        clientes: (s.clientes ?? []).map((sc) => ({
          id: sc.cliente.id,
          razonSocial: sc.cliente.razonSocial,
          ruc: sc.cliente.ruc,
        })),
        tieneOrden: !!s.orden,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// ── GET /api/facturas/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: facturaInclude,
    });
    if (!factura) return res.status(404).json({ error: "Factura no encontrada." });

    res.json({ ...factura, numeroCompleto: `${factura.serie}-${factura.numero}` });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/facturas/:id/sugerencias-servicio ────────────────────────────────
router.get("/:id/sugerencias-servicio", async (req, res, next) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: { cliente: true, guias: true },
    });
    if (!factura) return res.status(404).json({ error: "Factura no encontrada." });

    const fechaBase = factura.fechaEmision ?? new Date();
    const desde = new Date(fechaBase);
    const hasta = new Date(fechaBase);
    desde.setDate(desde.getDate() - 21);
    hasta.setDate(hasta.getDate() + 21);

    // Números de guías referenciadas en la factura
    const guiaNums = (factura.guias ?? []).map((g) => `${g.serieGuia}-${g.numeroGuia}`);

    const servicios = await prisma.servicio.findMany({
      where: {
        fechaServicio: { gte: desde, lte: hasta },
      },
      include: {
        vehiculo: true,
        conductor: true,
        clientes: { include: { cliente: true } },
        guias: { select: { serie: true, numero: true } },
        orden: true,
      },
      orderBy: { fechaServicio: "desc" },
      take: 80,
    });

    function calcScore(s) {
      let pts = 0;
      const razones = [];

      // 1. Coincidencia de guías relacionadas
      const svcGuiaNums = (s.guias ?? []).map((g) => `${g.serie}-${g.numero}`);
      const matchedGuias = guiaNums.filter((gn) => svcGuiaNums.includes(gn));
      if (matchedGuias.length > 0) {
        pts += 50 + (matchedGuias.length - 1) * 10;
        razones.push(`${matchedGuias.length} guía(s) relacionada(s) coinciden`);
      }

      // 2. RUC cliente coincide con clientes del servicio
      const clienteRucs = (s.clientes ?? []).map((sc) => sc.cliente?.ruc).filter(Boolean);
      if (factura.cliente?.ruc && clienteRucs.includes(factura.cliente.ruc)) {
        pts += 30;
        razones.push("Cliente (RUC) coincide con el servicio");
      }

      // 3. Cercanía de fecha
      if (s.fechaServicio && factura.fechaEmision) {
        const diffDays =
          Math.abs(new Date(s.fechaServicio).getTime() - new Date(factura.fechaEmision).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays < 1) { pts += 20; razones.push("Misma fecha"); }
        else if (diffDays <= 3) { pts += 14; razones.push("Fecha muy cercana"); }
        else if (diffDays <= 7) { pts += 8; razones.push("Fecha cercana"); }
        else if (diffDays <= 21) { pts += 2; razones.push("Fecha próxima"); }
      }

      // 4. Montos similares en orden existente
      if (s.orden && factura.total) {
        const ordenTotal = Number(s.orden.total);
        const factTotal = Number(factura.total);
        if (ordenTotal > 0 && Math.abs(ordenTotal - factTotal) / factTotal < 0.05) {
          pts += 15;
          razones.push("Monto total similar al de la orden");
        }
      }

      return { score: pts, razones };
    }

    const sugerencias = servicios
      .map((s) => {
        const { score, razones } = calcScore(s);
        return {
          id: s.id,
          fechaServicio: s.fechaServicio,
          origen: s.origen,
          destino: s.destino,
          estado: s.estado,
          vehiculo: s.vehiculo ? { id: s.vehiculo.id, placa: s.vehiculo.placa } : null,
          conductor: s.conductor
            ? {
                id: s.conductor.id,
                nombre: `${s.conductor.nombre} ${s.conductor.apPaterno}`.trim(),
              }
            : null,
          clientes: (s.clientes ?? []).map((sc) => ({
            id: sc.cliente.id,
            razonSocial: sc.cliente.razonSocial,
            ruc: sc.cliente.ruc,
          })),
          tieneOrden: !!s.orden,
          score,
          razones,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    res.json(sugerencias);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/facturas/importar ────────────────────────────────────────────────
router.post("/importar", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo." });

    const { buffer, originalname } = req.file;

    // 1. Resolver tipo de archivo
    let resolved;
    try {
      resolved = resolveImportFile(buffer, originalname);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // 2. Parsear
    let extracted;
    try {
      if (resolved.type === "XML") {
        extracted = parseXmlFactura(resolved.buffer);
      } else {
        extracted = await parsePdfFactura(resolved.buffer);
      }
    } catch (err) {
      const status = err.statusCode === 422 ? 422 : 422;
      return res.status(status).json({ error: err.message });
    }

    const { serie, numero } = extracted;

    // 3. Verificar duplicado
    const existing = await prisma.factura.findUnique({
      where: { serie_numero: { serie, numero } },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({
        error: `La factura ${serie}-${numero} ya existe en el sistema.`,
        facturaExistenteId: existing.id,
      });
    }

    // 4. Resolver/crear cliente
    let cliente = null;
    await prisma.$transaction(async (tx) => {
      cliente = await resolveOrCreateCliente(tx, {
        clienteRuc: extracted.clienteRuc,
        clienteNombre: extracted.clienteNombre,
      });
    });

    if (!cliente) {
      return res.status(422).json({
        error: `No se pudo resolver el cliente (RUC: ${extracted.clienteRuc ?? "N/A"}, Nombre: ${extracted.clienteNombre ?? "N/A"}). No se guardó la factura.`,
        warnings: extracted.warnings,
      });
    }

    // 5. Guardar en transacción
    const factura = await prisma.$transaction(async (tx) => {
      const created = await tx.factura.create({
        data: {
          clienteId: cliente.id,
          serie,
          numero,
          tipo: extracted.tipo ?? "FACTURA",
          fechaEmision: new Date(extracted.fechaEmision),
          fechaVencimiento: extracted.fechaVencimiento ? new Date(extracted.fechaVencimiento) : null,
          moneda: extracted.moneda ?? "PEN",
          montoNeto: extracted.montoNeto ?? 0,
          igv: extracted.igv ?? 0,
          total: extracted.total ?? 0,
          detraccionPorcentaje: extracted.detraccionPorcentaje ?? 0,
          detraccionMonto: extracted.detraccionMonto ?? 0,
          formaPago: extracted.formaPago ?? null,
          origenImportacion: resolved.sourceType,
          nombreArchivoOrigen: resolved.filename,
          rawPayload: extracted,
          estadoPago: "PENDIENTE",
        },
        include: facturaInclude,
      });

      await insertGuiasRelacionadas(tx, created.id, extracted.guiasRelacionadas);

      return created;
    });

    logger.info("Factura importada", {
      facturaId: factura.id,
      serie,
      numero,
      sourceType: resolved.sourceType,
      clienteId: cliente.id,
      usuarioId: req.user.id,
    });

    // 6. Checklist
    const checklist = buildFacturaChecklist({
      extracted,
      clienteResuelto: cliente,
      servicioSugerido: false,
    });

    res.status(201).json({
      factura: { ...factura, numeroCompleto: `${serie}-${numero}` },
      extractedData: extracted,
      checklist,
      warnings: checklist.warnings,
      sourceType: resolved.sourceType,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/facturas/importar-masivo ────────────────────────────────────────
router.post("/importar-masivo", uploadMasivo.array("files", 50), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No se recibieron archivos." });
    }

    // Recopilar todos los XML a procesar
    const xmlEntries = []; // { buffer, filename }

    for (const file of req.files) {
      const ext = file.originalname.split(".").pop().toLowerCase();
      if (ext === "xml") {
        xmlEntries.push({ buffer: file.buffer, filename: file.originalname });
      } else if (ext === "zip") {
        try {
          const entries = resolveZipXmlEntries(file.buffer, file.originalname);
          xmlEntries.push(...entries);
        } catch (err) {
          xmlEntries.push({ buffer: null, filename: file.originalname, errorInicio: err.message });
        }
      }
      // PDF: ignorar (el fileFilter ya lo rechaza, pero por seguridad)
    }

    if (xmlEntries.length === 0) {
      return res.status(400).json({
        error: "No se encontraron archivos XML válidos en los archivos subidos.",
      });
    }

    const totalRecibidos = xmlEntries.length;
    let importados = 0;
    let duplicados = 0;
    let fallidos = 0;
    const detalle = [];

    for (const entry of xmlEntries) {
      if (entry.errorInicio) {
        fallidos++;
        detalle.push({ filename: entry.filename, estado: "error", mensaje: entry.errorInicio });
        continue;
      }

      try {
        const result = await importarUnXml(entry.buffer, entry.filename);
        if (result.ok) {
          importados++;
          detalle.push({
            filename: entry.filename,
            estado: "importado",
            serie: result.serie,
            numero: result.numero,
            facturaId: result.facturaId,
          });
        } else if (result.duplicado) {
          duplicados++;
          detalle.push({
            filename: entry.filename,
            estado: "duplicado",
            mensaje: result.error,
            facturaId: result.facturaId,
          });
        } else {
          fallidos++;
          detalle.push({ filename: entry.filename, estado: "error", mensaje: result.error });
        }
      } catch (err) {
        fallidos++;
        logger.error("Error en importación masiva de factura", {
          filename: entry.filename,
          error: err.message,
          usuarioId: req.user.id,
        });
        detalle.push({ filename: entry.filename, estado: "error", mensaje: "Error interno al procesar el archivo." });
      }
    }

    logger.info("Importación masiva de facturas completada", {
      totalRecibidos,
      importados,
      duplicados,
      fallidos,
      usuarioId: req.user.id,
    });

    res.json({
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

// ── PATCH /api/facturas/:id ────────────────────────────────────────────────────
router.patch("/:id", async (req, res, next) => {
  try {
    const body = validate(patchFacturaSchema, req.body, res);
    if (!body) return;

    const factura = await prisma.factura.findUnique({ where: { id: req.params.id } });
    if (!factura) return res.status(404).json({ error: "Factura no encontrada." });

    const updated = await prisma.factura.update({
      where: { id: req.params.id },
      data: {
        ...(body.estadoPago !== undefined && { estadoPago: body.estadoPago }),
        ...(body.formaPago !== undefined && { formaPago: body.formaPago }),
        ...(body.fechaVencimiento !== undefined && {
          fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : null,
        }),
        ...(body.detraccionPorcentaje !== undefined && { detraccionPorcentaje: body.detraccionPorcentaje }),
        ...(body.detraccionMonto !== undefined && { detraccionMonto: body.detraccionMonto }),
      },
      include: facturaInclude,
    });

    logger.info("Factura actualizada", {
      facturaId: req.params.id,
      usuarioId: req.user.id,
      cambios: Object.keys(body),
    });

    res.json({ ...updated, numeroCompleto: `${updated.serie}-${updated.numero}`, message: "Cambios guardados correctamente" });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/facturas/:id/vincular ──────────────────────────────────────────
router.patch("/:id/vincular", async (req, res, next) => {
  try {
    const body = validate(vincularFacturaSchema, req.body, res);
    if (!body) return;

    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      include: { guias: true },
    });
    if (!factura) return res.status(404).json({ error: "Factura no encontrada." });

    const servicio = await prisma.servicio.findUnique({ where: { id: body.servicioId } });
    if (!servicio) return res.status(404).json({ error: "Servicio no encontrado." });

    // Buscar/crear OrdenServicio
    const orden = await prisma.$transaction((tx) =>
      resolveOrCreateOrden(tx, servicio, {
        montoNeto: Number(factura.montoNeto),
        igv: Number(factura.igv),
        total: Number(factura.total),
        detraccionMonto: Number(factura.detraccionMonto),
      })
    );

    const updated = await prisma.factura.update({
      where: { id: req.params.id },
      data: { ordenServicioId: orden.id },
      include: facturaInclude,
    });

    logger.info("Factura vinculada a servicio", {
      facturaId: req.params.id,
      servicioId: body.servicioId,
      ordenServicioId: orden.id,
      ordenCreada: !orden.createdAt || orden.createdAt > new Date(Date.now() - 5000),
      usuarioId: req.user.id,
    });

    res.json({
      ...updated,
      numeroCompleto: `${updated.serie}-${updated.numero}`,
      message: "Factura vinculada correctamente al servicio",
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/facturas/:id/desvincular ───────────────────────────────────────
router.patch("/:id/desvincular", async (req, res, next) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
    });
    if (!factura) return res.status(404).json({ error: "Factura no encontrada." });

    if (!factura.ordenServicioId) {
      return res.json({
        ...factura,
        numeroCompleto: `${factura.serie}-${factura.numero}`,
        message: "La factura ya no tiene servicio vinculado.",
      });
    }

    const updated = await prisma.factura.update({
      where: { id: req.params.id },
      data: { ordenServicioId: null },
      include: facturaInclude,
    });

    logger.info("Factura desvinculada de servicio", {
      facturaId: req.params.id,
      ordenAnteriorId: factura.ordenServicioId,
      usuarioId: req.user.id,
    });

    res.json({
      ...updated,
      numeroCompleto: `${updated.serie}-${updated.numero}`,
      message: "Factura desvinculada correctamente",
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/facturas/:id ──────────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  try {
    const factura = await prisma.factura.findUnique({
      where: { id: req.params.id },
      select: { id: true, serie: true, numero: true },
    });
    if (!factura) return res.status(404).json({ error: "Factura no encontrada." });

    await prisma.$transaction(async (tx) => {
      await tx.pago.deleteMany({ where: { facturaId: req.params.id } });
      await tx.facturaGuia.deleteMany({ where: { facturaId: req.params.id } });
      await tx.factura.delete({ where: { id: req.params.id } });
    });

    logger.info("Factura eliminada", {
      facturaId: req.params.id,
      serie: factura.serie,
      numero: factura.numero,
      usuarioId: req.user.id,
    });

    res.json({ ok: true, id: req.params.id, message: "Factura eliminada correctamente" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
