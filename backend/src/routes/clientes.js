const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/clientes/buscar
// Soporta dos modos:
//   ?texto=... → búsqueda parcial por razón social o RUC (top 10)
//   ?ruc=...   → búsqueda exacta por RUC (retorna objeto o null)
router.get("/buscar", async (req, res) => {
  try {
    const { texto, ruc } = req.query;

    // Modo legacy: búsqueda exacta por RUC
    if (ruc && !texto) {
      const cliente = await prisma.cliente.findUnique({ where: { ruc } });
      return res.json(cliente || null);
    }

    // Modo autocomplete: búsqueda parcial
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
    console.error(err);
    res.status(500).json({ error: "Error al buscar clientes" });
  }
});

// GET /api/clientes — listado completo
router.get("/", async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({ orderBy: { razonSocial: "asc" } });
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener clientes" });
  }
});

// POST /api/clientes — crear nuevo cliente
router.post("/", async (req, res) => {
  try {
    const { razonSocial, ruc } = req.body;

    if (!razonSocial?.trim()) return res.status(400).json({ error: "Debes ingresar la razón social." });
    if (!ruc?.trim())          return res.status(400).json({ error: "Debes ingresar el RUC." });
    if (!/^\d{11}$/.test(ruc.trim())) return res.status(400).json({ error: "El RUC debe tener 11 dígitos." });

    const existe = await prisma.cliente.findUnique({ where: { ruc: ruc.trim() } });
    if (existe) return res.status(409).json({ error: "Ya existe otro cliente registrado con ese RUC." });

    const cliente = await prisma.cliente.create({
      data: { razonSocial: razonSocial.trim(), ruc: ruc.trim() },
    });

    res.status(201).json(cliente);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear cliente" });
  }
});

// PUT /api/clientes/:id — actualizar cliente existente
// Valida unicidad de RUC excluyendo al propio registro
router.put("/:id", async (req, res) => {
  try {
    const { razonSocial, ruc } = req.body;

    const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!cliente) return res.status(404).json({ error: "No se encontró el cliente a editar." });

    if (ruc && ruc.trim() !== cliente.ruc) {
      if (!/^\d{11}$/.test(ruc.trim())) {
        return res.status(400).json({ error: "El RUC debe tener 11 dígitos." });
      }
      const duplicado = await prisma.cliente.findUnique({ where: { ruc: ruc.trim() } });
      if (duplicado && duplicado.id !== req.params.id) {
        return res.status(409).json({ error: "Ya existe otro cliente registrado con ese RUC." });
      }
    }

    const actualizado = await prisma.cliente.update({
      where: { id: req.params.id },
      data: {
        ...(razonSocial?.trim() && { razonSocial: razonSocial.trim() }),
        ...(ruc?.trim()          && { ruc: ruc.trim() }),
      },
    });

    res.json(actualizado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

module.exports = router;
