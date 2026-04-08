const { z } = require("zod");

function normalizeOptionalString(max, label) {
  return z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === "string") {
        const normalized = value.trim();
        return normalized === "" ? null : normalized;
      }
      return value;
    },
    z.string().max(max, `${label} demasiado largo`).nullable().optional(),
  );
}

const razonSocialSchema = z
  .string({ required_error: "Razon social es requerida" })
  .trim()
  .min(2, "Razon social demasiado corta")
  .max(300, "Razon social demasiado larga");

const rucSchema = z
  .string({ required_error: "RUC es requerido" })
  .trim()
  .regex(/^\d{11}$/, "El RUC debe tener exactamente 11 digitos numericos");

const emailSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "" ? null : normalized;
    }
    return value;
  },
  z.string().email("Formato de email invalido").max(254).nullable().optional(),
);

const clienteWriteShape = {
  razonSocial: razonSocialSchema,
  ruc: rucSchema,
  email: emailSchema,
  telefono: normalizeOptionalString(30, "Telefono"),
  direccion: normalizeOptionalString(500, "Direccion"),
};

const createClienteSchema = z.object(clienteWriteShape).strict();

const updateClienteSchema = z
  .object({
    razonSocial: razonSocialSchema.optional(),
    ruc: rucSchema.optional(),
    email: emailSchema,
    telefono: normalizeOptionalString(30, "Telefono"),
    direccion: normalizeOptionalString(500, "Direccion"),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debes enviar al menos un campo para actualizar.",
    path: ["body"],
  });

const servicioClienteLegacySchema = z.object(clienteWriteShape).strict();

module.exports = {
  createClienteSchema,
  razonSocialSchema,
  rucSchema,
  servicioClienteLegacySchema,
  updateClienteSchema,
};
