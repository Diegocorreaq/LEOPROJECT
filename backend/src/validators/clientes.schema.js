const { z } = require("zod");

const createClienteSchema = z.object({
  razonSocial: z
    .string({ required_error: "Razón social es requerida" })
    .min(2, "Razón social demasiado corta")
    .max(300, "Razón social demasiado larga")
    .trim(),
  ruc: z
    .string({ required_error: "RUC es requerido" })
    .regex(/^\d{11}$/, "El RUC debe tener exactamente 11 dígitos numéricos")
    .trim(),
  email: z.string().email("Formato de email inválido").max(254).trim().optional().nullable(),
  telefono: z.string().max(30, "Teléfono demasiado largo").trim().optional().nullable(),
  direccion: z.string().max(500, "Dirección demasiado larga").trim().optional().nullable(),
});

const updateClienteSchema = z.object({
  razonSocial: z.string().min(2).max(300).trim().optional(),
  ruc: z
    .string()
    .regex(/^\d{11}$/, "El RUC debe tener exactamente 11 dígitos numéricos")
    .trim()
    .optional(),
  email: z.string().email("Formato de email inválido").max(254).trim().optional().nullable(),
  telefono: z.string().max(30).trim().optional().nullable(),
  direccion: z.string().max(500).trim().optional().nullable(),
});

module.exports = { createClienteSchema, updateClienteSchema };
