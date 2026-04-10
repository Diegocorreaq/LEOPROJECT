const { z } = require("zod");

// Solo estados que se persisten en la columna `estado`.
// "VINCULADO" / "NO_VINCULADO" son derivados de servicioId, NO se persisten.
const ESTADOS_GUIA = ["EN_TRANSITO", "RECIBIDA"];

const vincularGuiaSchema = z.object({
  servicioId: z
    .string({ required_error: "servicioId es requerido" })
    .uuid("servicioId debe ser un UUID válido"),
  observaciones: z.string().max(2000).trim().optional().nullable(),
});

const patchEstadoGuiaSchema = z.object({
  estado: z.enum(ESTADOS_GUIA, {
    required_error: `Estado inválido. Valores permitidos: ${ESTADOS_GUIA.join(", ")}`,
  }),
});

const patchObservacionesGuiaSchema = z.object({
  observaciones: z
    .string({ required_error: "observaciones es requerido" })
    .max(2000)
    .trim(),
});

const patchGuiaSchema = z.object({
  estado: z.enum(ESTADOS_GUIA).optional(),
  observaciones: z.string().max(2000).trim().nullable().optional(),
  fechaRecepcion: z.preprocess(
    (value) => {
      if (value === "" || value == null) return null;
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return `${value.trim()}T00:00:00.000Z`;
      }
      return value;
    },
    z.string().datetime({ offset: true }).nullable().optional(),
  ),
}).strict().refine(
  (value) =>
    value.estado !== undefined ||
    value.observaciones !== undefined ||
    value.fechaRecepcion !== undefined,
  {
    message: "Debes enviar al menos un campo editable de la guía.",
  },
);

module.exports = {
  vincularGuiaSchema,
  patchEstadoGuiaSchema,
  patchObservacionesGuiaSchema,
  patchGuiaSchema,
  ESTADOS_GUIA,
};
