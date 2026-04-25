const { z } = require("zod");

const ESTADOS_PAGO = ["PENDIENTE", "PARCIAL", "PAGADA", "ANULADA", "OBSERVADA"];

const patchFacturaSchema = z
  .object({
    estadoPago: z.enum(ESTADOS_PAGO).optional(),
    formaPago: z.string().max(200).trim().nullable().optional(),
    fechaVencimiento: z.preprocess(
      (v) => {
        if (v === "" || v == null) return null;
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
          return `${v.trim()}T12:00:00.000Z`;
        }
        return v;
      },
      z.string().datetime({ offset: true }).nullable().optional()
    ),
    detraccionPorcentaje: z.number().min(0).max(100).optional(),
    detraccionMonto: z.number().min(0).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.estadoPago !== undefined ||
      v.formaPago !== undefined ||
      v.fechaVencimiento !== undefined ||
      v.detraccionPorcentaje !== undefined ||
      v.detraccionMonto !== undefined,
    { message: "Debes enviar al menos un campo editable." }
  );

const vincularFacturaSchema = z.object({
  servicioId: z
    .string({ required_error: "servicioId es requerido" })
    .uuid("servicioId debe ser un UUID válido"),
});

module.exports = {
  ESTADOS_PAGO,
  patchFacturaSchema,
  vincularFacturaSchema,
};
