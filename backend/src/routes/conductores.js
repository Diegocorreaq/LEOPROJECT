const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/conductores/buscar
// ?texto=...        búsqueda parcial por nombre, apellido paterno o nroDocumento (mín. 1 char)
// &soloPropio=true  solo conductores propios (propietarioSubcontratadoId: null)
router.get("/buscar", async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error: "Error al buscar conductores" });
  }
});

// GET /api/conductores
// Devuelve conductores propios: sin propietarioSubcontratado asignado.
// Acepta cualquier registro insertado directamente en la BD.
router.get("/", async (req, res) => {
  try {
    const conductores = await prisma.conductor.findMany({
      where: {
        activo: true,
        propietarioSubcontratadoId: null, // sin empresa externa = propio
      },
      orderBy: [{ apPaterno: "asc" }, { nombre: "asc" }],
    });
    res.json(conductores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener conductores" });
  }
});

module.exports = router;
