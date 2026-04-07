const { z } = require("zod");

function optionalTrimmedString(max, label) {
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
    z.string().max(max, `${label} demasiado largo`).nullable().optional()
  );
}

const createClienteSchema = z.object({
  razonSocial: z
    .string({ required_error: "Razon social es requerida" })
    .trim()
    .min(2, "Razon social demasiado corta")
    .max(300, "Razon social demasiado larga"),
  ruc: z
    .string({ required_error: "RUC es requerido" })
    .trim()
    .regex(/^\d{11}$/, "El RUC debe tener exactamente 11 digitos numericos"),
  email: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "" ? null : normalized;
      }
      return value;
    },
    z.string().email("Formato de email invalido").max(254).nullable().optional()
  ),
  telefono: optionalTrimmedString(30, "Telefono"),
  direccion: optionalTrimmedString(500, "Direccion"),
});

const updateClienteSchema = z
  .object({
    razonSocial: z.string().trim().min(2, "Razon social demasiado corta").max(300, "Razon social demasiado larga").optional(),
    ruc: z
      .string()
      .trim()
      .regex(/^\d{11}$/, "El RUC debe tener exactamente 11 digitos numericos")
      .optional(),
    email: z.preprocess(
      (value) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();
          return normalized === "" ? null : normalized;
        }
        return value;
      },
      z.string().email("Formato de email invalido").max(254).nullable().optional()
    ),
    telefono: optionalTrimmedString(30, "Telefono"),
    direccion: optionalTrimmedString(500, "Direccion"),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debes enviar al menos un campo para actualizar.",
    path: ["body"],
  });

module.exports = { createClienteSchema, updateClienteSchema };
