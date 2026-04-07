/**
 * vehiculos.js — Consulta de vehículos
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

// Tipos de unidad válidos (whitelist para evitar inyección)
const TIPOS_UNIDAD_VALIDOS = ["CAMION", "TRACTO", "FURGON", "PLATAFORMA", "VOLQUETE", "CISTERNA", "OTRO"];

// ── GET /api/vehiculos/buscar ──────────────────────────────────────────────
// ?texto=...       búsqueda parcial por placa (mín. 1 carácter)
// &soloPropio=true solo vehículos propios
// &tipoUnidad=...  filtro exacto por tipo (whitelist)
router.get("/buscar", async (req, res, next) => {
  try {
    const { texto, tipoUnidad, soloPropio } = req.query;

    if (!texto || texto.trim().length < 1) return res.json([]);

    const where = {
      placa: { contains: texto.trim().toUpperCase(), mode: "insensitive" },
    };

    // Validar tipoUnidad contra whitelist para evitar filtros inesperados
    if (tipoUnidad) {
      if (!TIPOS_UNIDAD_VALIDOS.includes(tipoUnidad)) {
        return res.status(400).json({ error: `tipoUnidad inválido. Valores: ${TIPOS_UNIDAD_VALIDOS.join(", ")}` });
      }
      where.tipoUnidad = tipoUnidad;
    }

    if (soloPropio === "true") where.propietarioSubcontratadoId = null;

    const vehiculos = await prisma.vehiculo.findMany({
      where,
      take: 10,
      orderBy: { placa: "asc" },
    });

    res.json(vehiculos);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/vehiculos ─────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: {
        estado: "ACTIVO",
        propietarioSubcontratadoId: null,
      },
      orderBy: { placa: "asc" },
    });
    res.json(vehiculos);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
