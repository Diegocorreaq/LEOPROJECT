const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { requireOperaciones } = require("../middleware/rbac");
const { validateRequest } = require("../lib/validate");
const { stringQueryField } = require("../validators/common.schema");

const router = express.Router();

const buscarUbigeosQuerySchema = z.object({
  texto: stringQueryField("texto", { max: 120 }),
}).strict();

function scoreUbigeo(item, query) {
  const distrito = item.distrito.toLowerCase();
  const provincia = item.provincia.toLowerCase();
  const departamento = item.departamento.toLowerCase();
  const etiqueta = item.etiqueta.toLowerCase();
  const codigo = item.codigo.toLowerCase();

  if (codigo === query) return 0;
  if (distrito === query) return 1;
  if (distrito.startsWith(query)) return 2;
  if (provincia === query) return 3;
  if (provincia.startsWith(query)) return 4;
  if (departamento === query) return 5;
  if (departamento.startsWith(query)) return 6;
  if (etiqueta.startsWith(query)) return 7;
  if (codigo.includes(query)) return 8;
  if (distrito.includes(query)) return 9;
  if (provincia.includes(query)) return 10;
  if (departamento.includes(query)) return 11;
  return 12;
}

router.use(authMiddleware);
router.use(requireOperaciones);

router.get("/buscar", async (req, res, next) => {
  try {
    const validated = validateRequest({ query: buscarUbigeosQuerySchema }, req, res);
    if (!validated) return;

    const texto = validated.query.texto?.trim() ?? "";
    if (texto.length < 1) {
      return res.json([]);
    }

    const normalized = texto.toLowerCase();
    const resultados = await prisma.ubigeo.findMany({
      where: {
        OR: [
          { codigo: { contains: texto } },
          { distrito: { contains: texto, mode: "insensitive" } },
          { provincia: { contains: texto, mode: "insensitive" } },
          { departamento: { contains: texto, mode: "insensitive" } },
          { etiqueta: { contains: texto, mode: "insensitive" } },
          { busqueda: { contains: normalized, mode: "insensitive" } },
        ],
      },
      select: {
        codigo: true,
        distrito: true,
        provincia: true,
        departamento: true,
        etiqueta: true,
      },
      take: 25,
    });

    resultados.sort((a, b) => {
      const scoreDiff = scoreUbigeo(a, normalized) - scoreUbigeo(b, normalized);
      if (scoreDiff !== 0) return scoreDiff;
      return a.etiqueta.localeCompare(b.etiqueta, "es");
    });

    res.json(resultados.slice(0, 10));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
