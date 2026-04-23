const { z } = require("zod");
const { LIQUIDACION_STATUS } = require("../modules/liquidaciones/computeLiquidacion");
const { LIQUIDACION_SALDO_MOVIMIENTO_TIPOS } = require("../modules/liquidaciones/settlement");

const moneySchema = z.preprocess(
  (value) => (value === "" || value == null ? 0 : value),
  z.coerce.number().min(0, "El valor debe ser mayor o igual a 0"),
);

const quantitySchema = z.preprocess(
  (value) => (value === "" || value == null ? 0 : value),
  z.coerce.number().min(0, "La cantidad debe ser mayor o igual a 0"),
);

const optionalStringSchema = z.string().trim().max(2000).optional().nullable();

const kmOdometroSchema = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number({ invalid_type_error: "El valor debe ser numerico" }).nonnegative("El km no puede ser negativo").nullable().optional(),
);

function refinirKm(schema) {
  return schema.superRefine((data, ctx) => {
    const ini = data.kmInicial ?? null;
    const fin = data.kmFinal ?? null;
    if (ini !== null && fin !== null && fin < ini) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El km final debe ser mayor o igual al km inicial.",
        path: ["kmFinal"],
      });
    }
  });
}

const createLiquidacionSchema = refinirKm(
  z.object({
    servicioId: z.string({ required_error: "servicioId es requerido" }).uuid("servicioId debe ser un UUID valido"),
    montoEntregado: moneySchema,
    viaticos: moneySchema,
    peajes: moneySchema,
    combustible: moneySchema,
    galones: quantitySchema,
    kmInicial: kmOdometroSchema,
    kmFinal: kmOdometroSchema,
    otros: moneySchema,
    status: z.enum(LIQUIDACION_STATUS).default("PENDIENTE"),
    observaciones: optionalStringSchema,
  }).strict(),
);

const updateLiquidacionSchema = refinirKm(
  z.object({
    servicioId: z.string({ required_error: "servicioId es requerido" }).uuid("servicioId debe ser un UUID valido"),
    montoEntregado: moneySchema,
    viaticos: moneySchema,
    peajes: moneySchema,
    combustible: moneySchema,
    galones: quantitySchema,
    kmInicial: kmOdometroSchema,
    kmFinal: kmOdometroSchema,
    otros: moneySchema,
    status: z.enum(LIQUIDACION_STATUS),
    observaciones: optionalStringSchema,
  }).strict(),
);

const patchLiquidacionStatusSchema = z.object({
  status: z.enum(LIQUIDACION_STATUS, {
    required_error: `status invalido. Valores permitidos: ${LIQUIDACION_STATUS.join(", ")}`,
  }),
}).strict();

const montoMovimientoSchema = z.preprocess(
  (value) => (value === "" || value == null ? 0 : value),
  z.coerce.number().gt(0, "El monto debe ser mayor a 0"),
);

const createLiquidacionSaldoMovimientoSchema = z.object({
  tipo: z.enum(LIQUIDACION_SALDO_MOVIMIENTO_TIPOS, {
    required_error: `tipo invalido. Valores permitidos: ${LIQUIDACION_SALDO_MOVIMIENTO_TIPOS.join(", ")}`,
  }),
  monto: montoMovimientoSchema,
  liquidacionDestinoId: z.preprocess(
    (value) => (value == null || value === "" ? undefined : value),
    z.string().uuid("liquidacionDestinoId debe ser un UUID valido").optional(),
  ),
  fechaMovimiento: z.preprocess(
    (value) => (value == null || value === "" ? undefined : value),
    z.coerce.date().optional(),
  ),
  observacion: z.preprocess(
    (value) => (value == null ? undefined : String(value).trim()),
    z.string().max(2000, "observacion demasiado larga").optional(),
  ),
}).strict();

module.exports = {
  LIQUIDACION_STATUS,
  LIQUIDACION_SALDO_MOVIMIENTO_TIPOS,
  createLiquidacionSchema,
  createLiquidacionSaldoMovimientoSchema,
  patchLiquidacionStatusSchema,
  updateLiquidacionSchema,
};
