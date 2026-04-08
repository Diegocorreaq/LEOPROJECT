const { z } = require("zod");
const { LIQUIDACION_STATUS } = require("../modules/liquidaciones/computeLiquidacion");

const moneySchema = z.preprocess(
  (value) => (value === "" || value == null ? 0 : value),
  z.coerce.number().min(0, "El valor debe ser mayor o igual a 0"),
);

const optionalStringSchema = z.string().trim().max(2000).optional().nullable();

const comprobanteSchema = z.object({
  tipo: z.string({ required_error: "tipo es requerido" }).trim().min(1).max(80),
  numero: z.string().trim().max(120).optional().nullable(),
  descripcion: z.string().trim().max(500).optional().nullable(),
  monto: moneySchema,
  urlArchivo: z.string().trim().url("urlArchivo debe ser una URL valida").max(500).optional().nullable(),
});

const createLiquidacionSchema = z.object({
  servicioId: z.string({ required_error: "servicioId es requerido" }).uuid("servicioId debe ser un UUID valido"),
  montoEntregado: moneySchema,
  viaticos: moneySchema,
  peajes: moneySchema,
  combustible: moneySchema,
  galones: moneySchema,
  otros: moneySchema,
  status: z.enum(LIQUIDACION_STATUS).default("PENDIENTE"),
  observaciones: optionalStringSchema,
  comprobantes: z.array(comprobanteSchema).optional().default([]),
}).strict();

const updateLiquidacionSchema = z.object({
  servicioId: z.string({ required_error: "servicioId es requerido" }).uuid("servicioId debe ser un UUID valido"),
  montoEntregado: moneySchema,
  viaticos: moneySchema,
  peajes: moneySchema,
  combustible: moneySchema,
  galones: moneySchema,
  otros: moneySchema,
  status: z.enum(LIQUIDACION_STATUS),
  observaciones: optionalStringSchema,
  comprobantes: z.array(comprobanteSchema).optional().default([]),
}).strict();

const patchLiquidacionStatusSchema = z.object({
  status: z.enum(LIQUIDACION_STATUS, {
    required_error: `status invalido. Valores permitidos: ${LIQUIDACION_STATUS.join(", ")}`,
  }),
}).strict();

module.exports = {
  LIQUIDACION_STATUS,
  comprobanteSchema,
  createLiquidacionSchema,
  patchLiquidacionStatusSchema,
  updateLiquidacionSchema,
};
