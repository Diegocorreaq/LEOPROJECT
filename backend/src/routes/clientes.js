const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const logger = require("../lib/logger");
const { validate } = require("../lib/validate");
const { createClienteSchema, updateClienteSchema } = require("../validators/clientes.schema");

const router = express.Router();

router.use(authMiddleware);
router.use(requireOperaciones);

router.get("/buscar", async (req, res, next) => {
  try {
    const texto = req.query.texto?.trim();
    const ruc = req.query.ruc?.trim();

    if (ruc && !texto) {
      if (!/^\d{1,11}$/.test(ruc)) return res.json(null);

      const cliente = await prisma.cliente.findUnique({
        where: { ruc },
        include: { _count: { select: { servicios: true, facturas: true } } },
      });

      return res.json(cliente || null);
    }

    if (!texto || texto.length < 2) return res.json([]);

    const clientes = await prisma.cliente.findMany({
      where: {
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
    const texto = req.query.texto?.trim();

    const where = texto
      ? {
          OR: [
            { razonSocial: { contains: texto, mode: "insensitive" } },
            { ruc: { contains: texto } },
            { email: { contains: texto, mode: "insensitive" } },
            { telefono: { contains: texto, mode: "insensitive" } },
          ],
        }
      : undefined;

    const clientes = await prisma.cliente.findMany({
      where,
      include: { _count: { select: { servicios: true, facturas: true } } },
      orderBy: { razonSocial: "asc" },
    });

    res.json(clientes);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [cliente, serviciosRecientes, facturasRecientes] = await Promise.all([
      prisma.cliente.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { servicios: true, facturas: true } } },
      }),
      prisma.servicio.findMany({
        where: { clientes: { some: { clienteId: req.params.id } } },
        orderBy: { fechaServicio: "desc" },
        take: 5,
        include: {
          vehiculo: true,
          conductor: true,
          clientes: { include: { cliente: true } },
        },
      }),
      prisma.factura.findMany({
        where: { clienteId: req.params.id },
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
        error: "Ya existe un cliente registrado con ese RUC.",
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
      },
      include: { _count: { select: { servicios: true, facturas: true } } },
    });

    logger.info("Cliente creado", { clienteId: cliente.id, usuarioId: req.user.id });
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const body = validate(updateClienteSchema, req.body, res);
    if (!body) return;

    const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    if (body.ruc && body.ruc !== cliente.ruc) {
      const duplicado = await prisma.cliente.findUnique({ where: { ruc: body.ruc } });
      if (duplicado && duplicado.id !== req.params.id) {
        return res.status(409).json({
          error: "Ya existe otro cliente con ese RUC.",
          detalles: [{ campo: "ruc", mensaje: "Ya existe otro cliente con ese RUC." }],
        });
      }
    }

    const actualizado = await prisma.cliente.update({
      where: { id: req.params.id },
      data: {
        ...(body.razonSocial !== undefined && { razonSocial: body.razonSocial }),
        ...(body.ruc !== undefined && { ruc: body.ruc }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.telefono !== undefined && { telefono: body.telefono }),
        ...(body.direccion !== undefined && { direccion: body.direccion }),
      },
      include: { _count: { select: { servicios: true, facturas: true } } },
    });

    logger.info("Cliente actualizado", { clienteId: req.params.id, usuarioId: req.user.id });
    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { servicios: true, facturas: true } } },
    });

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    if (cliente._count.servicios > 0 || cliente._count.facturas > 0) {
      return res.status(409).json({
        error: "No se puede eliminar el cliente porque tiene servicios o facturas asociadas.",
      });
    }

    await prisma.cliente.delete({ where: { id: req.params.id } });

    logger.info("Cliente eliminado", { clienteId: req.params.id, usuarioId: req.user.id });
    res.json({ ok: true, message: "Cliente eliminado correctamente." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
