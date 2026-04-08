const { z } = require("zod");
const { LIQUIDACION_STATUS } = require("../modules/liquidaciones/computeLiquidacion");

const moneySchema = z.preprocess(
  (value) => (value === "" || value == null ? 0 : value),
  z.coerce.number().min(0, "El valor debe ser mayor o igual a 0"),
);

const quantitySchema = z.preprocess(
  (value) => (value === "" || value == null ? 0 : value),
  z.coerce.number().min(0, "La cantidad debe ser mayor o igual a 0"),
);

const optionalStringSchema = z.string().trim().max(2000).optional().nullable();

const createLiquidacionSchema = z.object({
  servicioId: z.string({ required_error: "servicioId es requerido" }).uuid("servicioId debe ser un UUID valido"),
  montoEntregado: moneySchema,
  viaticos: moneySchema,
  peajes: moneySchema,
  combustible: moneySchema,
  galones: quantitySchema,
  otros: moneySchema,
  status: z.enum(LIQUIDACION_STATUS).default("PENDIENTE"),
  observaciones: optionalStringSchema,
}).strict();

const updateLiquidacionSchema = z.object({
  servicioId: z.string({ required_error: "servicioId es requerido" }).uuid("servicioId debe ser un UUID valido"),
  montoEntregado: moneySchema,
  viaticos: moneySchema,
  peajes: moneySchema,
  combustible: moneySchema,
  galones: quantitySchema,
  otros: moneySchema,
  status: z.enum(LIQUIDACION_STATUS),
  observaciones: optionalStringSchema,
}).strict();

const patchLiquidacionStatusSchema = z.object({
  status: z.enum(LIQUIDACION_STATUS, {
    required_error: `status invalido. Valores permitidos: ${LIQUIDACION_STATUS.join(", ")}`,
  }),
}).strict();

module.exports = {
  LIQUIDACION_STATUS,
  createLiquidacionSchema,
  patchLiquidacionStatusSchema,
  updateLiquidacionSchema,
};
