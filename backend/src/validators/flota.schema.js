const { z } = require("zod");

const TIPOS_DOC = [
  "SOAT",
  "REV_TEC_GENERAL",
  "REV_TEC_MATPEL",
  "TC_MATPEL",
  "TC_MERCANCIAS",
  "EXTINTOR",
];

const TIPOS_DOC_LABELS = {
  SOAT: "SOAT",
  REV_TEC_GENERAL: "Revisión técnica general",
  REV_TEC_MATPEL: "Revisión técnica MATPEL",
  TC_MATPEL: "Tarjeta de circulación MATPEL",
  TC_MERCANCIAS: "Tarjeta de circulación mercancías",
  EXTINTOR: "Extintor",
};

const COMPONENTES_KM = ["MOTOR", "CORONA", "CAJA", "EMBRAGUE"];

const COMPONENTES_KM_LABELS = {
  MOTOR: "Motor",
  CORONA: "Corona",
  CAJA: "Caja",
  EMBRAGUE: "Embrague",
};

function normalizeDateOnly(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return `${value.trim()}T12:00:00.000Z`;
  }
  return value;
}

const upsertDocVehiculoSchema = z
  .object({
    fechaVencimiento: z.preprocess(
      normalizeDateOnly,
      z.coerce.date().nullable().optional(),
    ),
    observacion: z
      .preprocess(
        (value) => (value == null ? null : String(value).trim()),
        z.string().max(2000, "Observacion demasiado larga").nullable().optional(),
      ),
  })
  .strict();

const updateMantenimientoSchema = z
  .object({
    kmPermitido: z.preprocess(
      (value) => (value == null || value === "" ? undefined : value),
      z.coerce
        .number({ invalid_type_error: "kmPermitido debe ser numerico" })
        .nonnegative("kmPermitido no puede ser negativo")
        .optional(),
    ),
    rendimientoEstandar: z.preprocess(
      (value) => (value == null || value === "" ? undefined : value),
      z.coerce
        .number({ invalid_type_error: "rendimientoEstandar debe ser numerico" })
        .nonnegative("rendimientoEstandar no puede ser negativo")
        .optional(),
    ),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Debes enviar al menos un campo para actualizar.",
    path: ["body"],
  });

module.exports = {
  TIPOS_DOC,
  TIPOS_DOC_LABELS,
  COMPONENTES_KM,
  COMPONENTES_KM_LABELS,
  upsertDocVehiculoSchema,
  updateMantenimientoSchema,
};
