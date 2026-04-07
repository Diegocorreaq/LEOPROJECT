const express = require("express");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/vehiculos/buscar
// ?texto=...           búsqueda parcial por placa (mín. 1 carácter)
// &soloPropio=true     solo vehículos propios (propietarioSubcontratadoId: null)
// &tipoUnidad=...      filtro exacto por tipo de unidad (ej. "PLATAFORMA")
router.get("/buscar", async (req, res) => {
  try {
    const { texto, tipoUnidad, soloPropio } = req.query;

    if (!texto || texto.trim().length < 1) return res.json([]);

    const where = {
      placa: { contains: texto.trim(), mode: "insensitive" },
    };

    if (tipoUnidad) where.tipoUnidad = tipoUnidad;
    if (soloPropio === "true") where.propietarioSubcontratadoId = null;

    const vehiculos = await prisma.vehiculo.findMany({
      where,
      take: 10,
      orderBy: { placa: "asc" },
    });

    res.json(vehiculos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al buscar vehículos" });
  }
});

// GET /api/vehiculos
// Devuelve vehículos propios: sin propietarioSubcontratado asignado, o con tipo PROPIO.
// Acepta cualquier registro insertado directamente en la BD.
router.get("/", async (req, res) => {
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      where: {
        estado: "ACTIVO",
        propietarioSubcontratadoId: null, // sin empresa externa = propio
      },
      orderBy: { placa: "asc" },
    });
    res.json(vehiculos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener vehículos" });
  }
});

module.exports = router;
