/**
 * conductores.js — Consulta de conductores
 *
 * Cambios de seguridad:
 *  - RBAC: requireOperaciones
 *  - Sanitización de parámetros de query
 *  - Propagación de errores al error handler centralizado
 */

const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");

const router = express.Router();
router.use(authMiddleware);
router.use(requireOperaciones);

// ── GET /api/conductores/buscar ────────────────────────────────────────────
// ?texto=...        búsqueda parcial por nombre, apellido o nroDocumento
// &soloPropio=true  solo conductores propios
router.get("/buscar", async (req, res, next) => {
  try {
    const { texto, soloPropio } = req.query;

    if (!texto || texto.trim().length < 1) return res.json([]);

    const where = {
      activo: true,
      OR: [
        { nombre:      { contains: texto.trim(), mode: "insensitive" } },
        { apPaterno:   { contains: texto.trim(), mode: "insensitive" } },
        { apMaterno:   { contains: texto.trim(), mode: "insensitive" } },
        { nroDocumento:{ contains: texto.trim() } },
      ],
    };

    if (soloPropio === "true") where.propietarioSubcontratadoId = null;

    const conductores = await prisma.conductor.findMany({
      where,
      take: 10,
      orderBy: [{ apPaterno: "asc" }, { nombre: "asc" }],
    });

    res.json(conductores);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/conductores ───────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const conductores = await prisma.conductor.findMany({
      where: {
        activo: true,
        propietarioSubcontratadoId: null,
      },
      orderBy: [{ apPaterno: "asc" }, { nombre: "asc" }],
    });
    res.json(conductores);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
