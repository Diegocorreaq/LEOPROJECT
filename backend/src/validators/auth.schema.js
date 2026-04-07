const { z } = require("zod");

const loginSchema = z.object({
  email: z
    .string({ required_error: "Email es requerido" })
    .email("Formato de email inválido")
    .max(254, "Email demasiado largo")
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: "Contraseña es requerida" })
    .min(1, "Contraseña es requerida")
    .max(128, "Contraseña demasiado larga"),
});

module.exports = { loginSchema };
