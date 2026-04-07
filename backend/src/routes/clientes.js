/**
 * clientes.js — CRUD de clientes
 *
 * Cambios de seguridad:
 *  - Validación Zod en POST y PUT
 *  - RBAC: requireOperaciones
 *  - Logging de auditoría en creación y modificación
 */

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

// ── GET /api/clientes/buscar ───────────────────────────────────────────────
// ?texto=... → búsqueda parcial por razón social o RUC (top 10)
// ?ruc=...   → búsqueda exacta por RUC
router.get("/buscar", async (req, res, next) => {
  try {
    const { texto, ruc } = req.query;

    // Modo legacy: búsqueda exacta por RUC
    if (ruc && !texto) {
      // Validar formato básico
      if (!/^\d{1,11}$/.test(ruc.trim())) {
        return res.json(null);
      }
      const cliente = await prisma.cliente.findUnique({ where: { ruc: ruc.trim() } });
      return res.json(cliente || null);
    }

    if (!texto || texto.trim().length < 2) return res.json([]);

    const clientes = await prisma.cliente.findMany({
      where: {
        OR: [
          { razonSocial: { contains: texto.trim(), mode: "insensitive" } },
          { ruc: { contains: texto.trim() } },
        ],
      },
      take: 10,
      orderBy: { razonSocial: "asc" },
    });

    res.json(clientes);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/clientes ──────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const clientes = await prisma.cliente.findMany({ orderBy: { razonSocial: "asc" } });
    res.json(clientes);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/clientes ─────────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const body = validate(createClienteSchema, req.body, res);
    if (!body) return;

    const { razonSocial, ruc, email, telefono, direccion } = body;

    const existe = await prisma.cliente.findUnique({ where: { ruc } });
    if (existe) {
      return res.status(409).json({ error: "Ya existe un cliente registrado con ese RUC." });
    }

    const cliente = await prisma.cliente.create({
      data: { razonSocial, ruc, email: email || null, telefono: telefono || null, direccion: direccion || null },
    });

    logger.info("Cliente creado", { clienteId: cliente.id, ruc, usuarioId: req.user.id });

    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/clientes/:id ──────────────────────────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const body = validate(updateClienteSchema, req.body, res);
    if (!body) return;

    const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado." });

    // Verificar unicidad de RUC si cambia
    if (body.ruc && body.ruc !== cliente.ruc) {
      const duplicado = await prisma.cliente.findUnique({ where: { ruc: body.ruc } });
      if (duplicado && duplicado.id !== req.params.id) {
        return res.status(409).json({ error: "Ya existe otro cliente con ese RUC." });
      }
    }

    const actualizado = await prisma.cliente.update({
      where: { id: req.params.id },
      data: {
        ...(body.razonSocial !== undefined && { razonSocial: body.razonSocial }),
        ...(body.ruc         !== undefined && { ruc: body.ruc }),
        ...(body.email       !== undefined && { email: body.email }),
        ...(body.telefono    !== undefined && { telefono: body.telefono }),
        ...(body.direccion   !== undefined && { direccion: body.direccion }),
      },
    });

    logger.info("Cliente actualizado", { clienteId: req.params.id, usuarioId: req.user.id });

    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
