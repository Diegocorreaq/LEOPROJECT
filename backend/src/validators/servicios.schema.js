const { z } = require("zod");
const { servicioClienteLegacySchema } = require("./clientes.schema");
const {
  booleanQueryField,
  enumQueryField,
  idParamSchema,
  paginationQuerySchema,
  stringQueryField,
} = require("./common.schema");

const TIPOS_CONTRATO = ["PROPIO", "SUBCONTRATADO"];
const ESTADOS_SERVICIO = ["PROGRAMADO", "EN_TRANSITO", "COMPLETADO", "CANCELADO"];
const TIPOS_UNIDAD = ["CAMION", "TRACTO", "FURGON", "PLATAFORMA", "VOLQUETE", "CISTERNA", "OTRO"];
const TIPOS_DOCUMENTO = ["DNI", "RUC", "CE", "PASAPORTE"];

const empresaSubSchema = z.object({
  razonSocial: z.string().trim().min(2).max(300),
  ruc: z.string().trim().regex(/^\d{11}$/, "RUC de empresa debe tener 11 digitos"),
  contacto: z.string().trim().max(200).optional().nullable(),
  telefono: z.string().trim().max(30).optional().nullable(),
}).strict();

const vehiculoSubSchema = z.object({
  placa: z.string().trim().min(1, "Placa es requerida").max(20).toUpperCase(),
  placaCarreta: z.string().trim().max(20).toUpperCase().optional().nullable(),
  tipoUnidad: z.enum(TIPOS_UNIDAD).optional().default("CAMION"),
}).strict();

const conductorSubSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  apPaterno: z.string().trim().min(1).max(100),
  apMaterno: z.string().trim().max(100).optional().nullable(),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO).optional().default("DNI"),
  nroDocumento: z.string().trim().min(8).max(20),
  licencia: z.string().trim().max(20).optional().nullable(),
}).strict();

const subcontratadoSchema = z.object({
  empresa: empresaSubSchema,
  vehiculo: vehiculoSubSchema,
  conductor: conductorSubSchema,
}).strict();

const baseServicioShape = {
  fechaServicio: z.string({ required_error: "fechaServicio es requerida" }).trim().min(1, "fechaServicio es requerida"),
  origen: z.string({ required_error: "origen es requerido" }).trim().min(2).max(300),
  destino: z.string({ required_error: "destino es requerido" }).trim().min(2).max(300),
  estado: z.enum(ESTADOS_SERVICIO).default("PROGRAMADO"),
  observaciones: z.string().trim().max(2000).optional().nullable(),
  tipoContrato: z.enum(TIPOS_CONTRATO, {
    required_error: "tipoContrato es requerido (PROPIO o SUBCONTRATADO)",
  }),
  vehiculoId: z.string().uuid("vehiculoId debe ser un UUID valido").optional(),
  conductorId: z.string().uuid("conductorId debe ser un UUID valido").optional(),
  subcontratado: subcontratadoSchema.optional(),
  clienteIds: z.array(z.string().uuid("Cada clienteId debe ser un UUID valido")).min(1, "Se requiere al menos un cliente").optional(),
  clientes: z.array(servicioClienteLegacySchema).min(1, "Se requiere al menos un cliente").optional(),
};

function enforceServicioRules(data, ctx, { requireAtLeastOneClient = true, partial = false } = {}) {
  if (data.clienteIds && data.clientes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "No puedes enviar clienteIds y clientes al mismo tiempo.",
      path: ["clienteIds"],
    });
  }

  if (data.tipoContrato === "PROPIO") {
    if (!partial || data.vehiculoId !== undefined) {
      if (!data.vehiculoId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vehiculoId es requerido para contrato PROPIO",
          path: ["vehiculoId"],
        });
      }
    }

    if (!partial || data.conductorId !== undefined) {
      if (!data.conductorId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "conductorId es requerido para contrato PROPIO",
          path: ["conductorId"],
        });
      }
    }

    if (data.subcontratado) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No debes enviar datos de subcontratado para contrato PROPIO",
        path: ["subcontratado"],
      });
    }
  }

  if (data.tipoContrato === "SUBCONTRATADO" && !data.subcontratado) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El bloque subcontratado es requerido para contrato SUBCONTRATADO",
      path: ["subcontratado"],
    });
  }

  if (requireAtLeastOneClient && !data.clienteIds && !data.clientes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes enviar clienteIds o clientes.",
      path: ["clienteIds"],
    });
  }
}

const createServicioSchema = z
  .object(baseServicioShape)
  .strict()
  .superRefine((data, ctx) => enforceServicioRules(data, ctx));

const updateServicioSchema = z
  .object({
    fechaServicio: baseServicioShape.fechaServicio.optional(),
    origen: baseServicioShape.origen.optional(),
    destino: baseServicioShape.destino.optional(),
    estado: baseServicioShape.estado.optional(),
    observaciones: baseServicioShape.observaciones,
    tipoContrato: baseServicioShape.tipoContrato.optional(),
    vehiculoId: baseServicioShape.vehiculoId,
    conductorId: baseServicioShape.conductorId,
    subcontratado: baseServicioShape.subcontratado,
    clienteIds: baseServicioShape.clienteIds,
    clientes: baseServicioShape.clientes,
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debes enviar al menos un campo para actualizar.",
    path: ["body"],
  })
  .superRefine((data, ctx) => {
    if (data.tipoContrato) {
      enforceServicioRules(data, ctx, { requireAtLeastOneClient: false, partial: true });
    }

    if (data.subcontratado && data.tipoContrato && data.tipoContrato !== "SUBCONTRATADO") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los datos de subcontratado solo aplican cuando tipoContrato es SUBCONTRATADO",
        path: ["subcontratado"],
      });
    }
  });

const patchEstadoSchema = z.object({
  estado: z.enum(ESTADOS_SERVICIO, {
    required_error: `Estado invalido. Valores: ${ESTADOS_SERVICIO.join(", ")}`,
  }),
}).strict();

const servicioIdParamSchema = idParamSchema;

const listServiciosQuerySchema = paginationQuerySchema.extend({
  texto: stringQueryField("texto"),
  estado: enumQueryField(ESTADOS_SERVICIO, "estado"),
  tipoContrato: enumQueryField(TIPOS_CONTRATO, "tipoContrato"),
  conObservaciones: booleanQueryField("conObservaciones"),
}).strict();

module.exports = {
  ESTADOS_SERVICIO,
  TIPOS_CONTRATO,
  TIPOS_DOCUMENTO,
  TIPOS_UNIDAD,
  createServicioSchema,
  listServiciosQuerySchema,
  patchEstadoSchema,
  servicioIdParamSchema,
  updateServicioSchema,
};
