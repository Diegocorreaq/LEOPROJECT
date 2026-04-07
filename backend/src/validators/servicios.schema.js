const { z } = require("zod");

const TIPOS_CONTRATO = ["PROPIO", "SUBCONTRATADO"];
const ESTADOS_SERVICIO = ["PROGRAMADO", "EN_TRANSITO", "COMPLETADO", "CANCELADO"];
const TIPOS_UNIDAD = ["CAMION", "TRACTO", "FURGON", "PLATAFORMA", "VOLQUETE", "CISTERNA", "OTRO"];
const TIPOS_DOCUMENTO = ["DNI", "RUC", "CE", "PASAPORTE"];

const empresaSubSchema = z.object({
  razonSocial: z.string().min(2).max(300).trim(),
  ruc: z
    .string()
    .regex(/^\d{11}$/, "RUC de empresa debe tener 11 dígitos")
    .trim(),
  contacto: z.string().max(200).trim().optional().nullable(),
  telefono: z.string().max(30).trim().optional().nullable(),
});

const vehiculoSubSchema = z.object({
  placa: z
    .string()
    .min(1, "Placa es requerida")
    .max(20)
    .toUpperCase()
    .trim(),
  placaCarreta: z.string().max(20).toUpperCase().trim().optional().nullable(),
  tipoUnidad: z.enum(TIPOS_UNIDAD, {
    errorMap: () => ({ message: `Tipo de unidad inválido. Valores: ${TIPOS_UNIDAD.join(", ")}` }),
  }).optional().default("CAMION"),
});

const conductorSubSchema = z.object({
  nombre: z.string().min(1).max(100).trim(),
  apPaterno: z.string().min(1).max(100).trim(),
  apMaterno: z.string().max(100).trim().optional().nullable(),
  tipoDocumento: z
    .enum(TIPOS_DOCUMENTO, {
      errorMap: () => ({ message: `Tipo documento inválido. Valores: ${TIPOS_DOCUMENTO.join(", ")}` }),
    })
    .optional()
    .default("DNI"),
  nroDocumento: z.string().min(8).max(20).trim(),
  licencia: z.string().max(20).trim().optional().nullable(),
});

const subcontratadoSchema = z.object({
  empresa: empresaSubSchema,
  vehiculo: vehiculoSubSchema,
  conductor: conductorSubSchema,
});

const createServicioSchema = z
  .object({
    fechaServicio: z
      .string({ required_error: "fechaServicio es requerida" })
      .min(1, "fechaServicio es requerida"),
    origen: z
      .string({ required_error: "Origen es requerido" })
      .min(2, "Origen demasiado corto")
      .max(300)
      .trim(),
    destino: z
      .string({ required_error: "Destino es requerido" })
      .min(2, "Destino demasiado corto")
      .max(300)
      .trim(),
    estado: z.enum(ESTADOS_SERVICIO).optional().default("PROGRAMADO"),
    observaciones: z.string().max(2000).trim().optional().nullable(),
    tipoContrato: z.enum(TIPOS_CONTRATO, {
      required_error: "tipoContrato es requerido (PROPIO o SUBCONTRATADO)",
    }),
    vehiculoId: z.string().uuid("vehiculoId debe ser un UUID válido").optional(),
    conductorId: z.string().uuid("conductorId debe ser un UUID válido").optional(),
    subcontratado: subcontratadoSchema.optional(),
    clienteIds: z
      .array(z.string().uuid("Cada clienteId debe ser un UUID válido"))
      .min(1, "Se requiere al menos un cliente"),
  })
  .superRefine((data, ctx) => {
    if (data.tipoContrato === "PROPIO") {
      if (!data.vehiculoId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vehiculoId es requerido para contrato PROPIO",
          path: ["vehiculoId"],
        });
      }
      if (!data.conductorId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "conductorId es requerido para contrato PROPIO",
          path: ["conductorId"],
        });
      }
    }
    if (data.tipoContrato === "SUBCONTRATADO" && !data.subcontratado) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El bloque 'subcontratado' es requerido para contrato SUBCONTRATADO",
        path: ["subcontratado"],
      });
    }
  });

const updateServicioSchema = z.object({
  fechaServicio: z.string().optional(),
  origen: z.string().min(2).max(300).trim().optional(),
  destino: z.string().min(2).max(300).trim().optional(),
  estado: z.enum(ESTADOS_SERVICIO).optional(),
  observaciones: z.string().max(2000).trim().optional().nullable(),
});

const patchEstadoSchema = z.object({
  estado: z.enum(ESTADOS_SERVICIO, {
    required_error: `Estado inválido. Valores: ${ESTADOS_SERVICIO.join(", ")}`,
  }),
});

module.exports = {
  createServicioSchema,
  updateServicioSchema,
  patchEstadoSchema,
};
