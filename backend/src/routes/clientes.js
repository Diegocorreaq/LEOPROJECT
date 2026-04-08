const { z } = require("zod");
const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireAdmin, requireOperaciones } = require("../middleware/rbac");
const { recordAuditEvent } = require("../lib/audit");
const { applyPaginationHeaders, resolvePagination } = require("../lib/pagination");
const { validate, validateRequest } = require("../lib/validate");
const { createClienteSchema, updateClienteSchema } = require("../validators/clientes.schema");
const {
  booleanQueryField,
  idParamSchema,
  paginationQuerySchema,
  stringQueryField,
} = require("../validators/common.schema");

const router = express.Router();

router.use(authMiddleware);
router.use(requireOperaciones);

const clienteSearchQuerySchema = z.object({
  texto: stringQueryField("texto"),
  ruc: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().regex(/^\d{1,11}$/, "ruc debe ser numerico").optional(),
  ),
  incluirInactivos: booleanQueryField("incluirInactivos"),
}).strict();

const clienteListQuerySchema = paginationQuerySchema.extend({
  texto: stringQueryField("texto"),
  incluirInactivos: booleanQueryField("incluirInactivos"),
}).strict();

router.get("/buscar", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: clienteSearchQuerySchema }, req, res);
    if (!validated) return;

    const { texto, ruc, incluirInactivos } = validated.query;
    const activoFilter = incluirInactivos ? {} : { activo: true };

    if (ruc && !texto) {
      const cliente = await prisma.cliente.findUnique({
        where: { ruc },
        include: { _count: { select: { servicios: true, facturas: true } } },
      });

      if (!cliente || (!incluirInactivos && !cliente.activo)) {
        return res.json(null);
      }

      return res.json(cliente);
    }

    if (!texto || texto.length < 2) return res.json([]);

    const clientes = await prisma.cliente.findMany({
      where: {
        ...activoFilter,
        OR: [
          { razonSocial: { contains: texto, mode: "insensitive" } },
          { ruc: { contains: texto } },
          { email: { contains: texto, mode: "insensitive" } },
        ],
      },
      include: { _count: { select: { servicios: true, facturas: true } } },
      take: 10,
      orderBy: { razonSocial: "asc" },
    });

    res.json(clientes);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: clienteListQuerySchema }, req, res);
    if (!validated) return;

    const { texto, incluirInactivos } = validated.query;
    const pagination = resolvePagination(validated.query, { defaultLimit: 100, maxLimit: 100 });

    const where = {
      ...(incluirInactivos ? {} : { activo: true }),
      ...(texto
        ? {
            OR: [
              { razonSocial: { contains: texto, mode: "insensitive" } },
              { ruc: { contains: texto } },
              { email: { contains: texto, mode: "insensitive" } },
              { telefono: { contains: texto, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, clientes] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({
        where,
        include: { _count: { select: { servicios: true, facturas: true } } },
        orderBy: { razonSocial: "asc" },
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    applyPaginationHeaders(res, { ...pagination, total });
    res.json(clientes);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const clienteId = validated.params.id;
    const [cliente, serviciosRecientes, facturasRecientes] = await Promise.all([
      prisma.cliente.findUnique({
        where: { id: clienteId },
        include: { _count: { select: { servicios: true, facturas: true } } },
      }),
      prisma.servicio.findMany({
        where: { clientes: { some: { clienteId } } },
        orderBy: { fechaServicio: "desc" },
        take: 5,
        include: {
          vehiculo: true,
          conductor: true,
          clientes: { include: { cliente: true } },
        },
      }),
      prisma.factura.findMany({
        where: { clienteId },
        orderBy: { fechaEmision: "desc" },
        take: 5,
        include: { ordenServicio: true },
      }),
    ]);

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    res.json({
      ...cliente,
      serviciosRecientes,
      facturasRecientes,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = validate(createClienteSchema, req.body, res);
    if (!body) return;

    const duplicado = await prisma.cliente.findUnique({ where: { ruc: body.ruc } });
    if (duplicado) {
      return res.status(409).json({
        error: duplicado.activo
          ? "Ya existe un cliente registrado con ese RUC."
          : "Ya existe un cliente inactivo registrado con ese RUC. Reactivalo en lugar de crear uno nuevo.",
        detalles: [{ campo: "ruc", mensaje: "Ya existe un cliente registrado con ese RUC." }],
      });
    }

    const cliente = await prisma.cliente.create({
      data: {
        razonSocial: body.razonSocial,
        ruc: body.ruc,
        email: body.email ?? null,
        telefono: body.telefono ?? null,
        direccion: body.direccion ?? null,
        activo: true,
      },
      include: { _count: { select: { servicios: true, facturas: true } } },
    });

    req.log.info("Cliente creado", { clienteId: cliente.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Cliente",
      entityId: cliente.id,
      action: "create",
      req,
      metadata: { ruc: cliente.ruc },
    });

    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const body = validate(updateClienteSchema, req.body, res);
    if (!body) return;

    const cliente = await prisma.cliente.findUnique({ where: { id: validated.params.id } });
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    if (body.ruc && body.ruc !== cliente.ruc) {
      const duplicado = await prisma.cliente.findUnique({ where: { ruc: body.ruc } });
      if (duplicado && duplicado.id !== validated.params.id) {
        return res.status(409).json({
          error: "Ya existe otro cliente con ese RUC.",
          detalles: [{ campo: "ruc", mensaje: "Ya existe otro cliente con ese RUC." }],
        });
      }
    }

    const actualizado = await prisma.cliente.update({
      where: { id: validated.params.id },
      data: {
        ...(body.razonSocial !== undefined && { razonSocial: body.razonSocial }),
        ...(body.ruc !== undefined && { ruc: body.ruc }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.telefono !== undefined && { telefono: body.telefono }),
        ...(body.direccion !== undefined && { direccion: body.direccion }),
      },
      include: { _count: { select: { servicios: true, facturas: true } } },
    });

    req.log.info("Cliente actualizado", { clienteId: validated.params.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Cliente",
      entityId: actualizado.id,
      action: "update",
      req,
      metadata: { campos: Object.keys(body) },
    });

    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const validated = validateRequest({ params: idParamSchema }, req, res);
    if (!validated) return;

    const cliente = await prisma.cliente.findUnique({
      where: { id: validated.params.id },
      include: { _count: { select: { servicios: true, facturas: true } } },
    });

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    if (!cliente.activo) {
      return res.json({ ok: true, message: "El cliente ya se encuentra inactivo." });
    }

    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { activo: false },
    });

    req.log.info("Cliente desactivado", { clienteId: cliente.id, usuarioId: req.user.id });
    await recordAuditEvent({
      entityType: "Cliente",
      entityId: cliente.id,
      action: "deactivate",
      req,
      metadata: {
        serviciosRelacionados: cliente._count.servicios,
        facturasRelacionadas: cliente._count.facturas,
      },
    });

    res.json({ ok: true, message: "Cliente desactivado correctamente." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
