const { z } = require("zod");

const TIPOS_UNIDAD = ["CAMION", "TRACTO", "FURGON", "PLATAFORMA", "VOLQUETE", "CISTERNA", "OTRO", "CAMIONETA", "AUTO", "FURGON 2TN", "FURGON 10TN", "BARANDA REBATIBLE 2TN", "BARANDA REBATIBLE 10TN", "CAMABAJA"];
const TIPOS_VEHICULO = ["PROPIO", "SUBCONTRATADO"];
const ESTADOS_VEHICULO = ["ACTIVO", "INACTIVO"];
const PLACA_REGEX = /^[A-Z0-9-]{5,20}$/;

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

function optionalUppercaseString(max, label, regex, regexMessage) {
  return z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === "string") {
        const normalized = value.trim().toUpperCase();
        return normalized === "" ? null : normalized;
      }
      return value;
    },
    z
      .string()
      .max(max, `${label} demasiado largo`)
      .regex(regex, regexMessage)
      .nullable()
      .optional()
  );
}

const decimalField = (label) =>
  z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      if (typeof value === "string") {
        const normalized = value.trim().replace(",", ".");
        if (normalized === "") return null;
        return Number(normalized);
      }
      return value;
    },
    z.number({ invalid_type_error: `${label} debe ser numerico` }).nonnegative(`${label} no puede ser negativo`).nullable().optional()
  );

const propietarioSchema = z.object({
  razonSocial: z
    .string({ required_error: "La razon social del propietario es requerida" })
    .trim()
    .min(2, "Razon social demasiado corta")
    .max(300, "Razon social demasiado larga"),
  ruc: z
    .string({ required_error: "El RUC del propietario es requerido" })
    .trim()
    .regex(/^\d{11}$/, "El RUC del propietario debe tener 11 digitos"),
  contacto: optionalTrimmedString(200, "Contacto"),
  telefono: optionalTrimmedString(30, "Telefono"),
});

const createVehiculoSchema = z
  .object({
    placa: z
      .string({ required_error: "La placa es requerida" })
      .trim()
      .toUpperCase()
      .regex(PLACA_REGEX, "Formato de placa invalido"),
    placaCarreta: optionalUppercaseString(20, "Placa carreta", PLACA_REGEX, "Formato de placa carreta invalido"),
    tipoUnidad: z.enum(TIPOS_UNIDAD, {
      errorMap: () => ({ message: `Tipo de unidad invalido. Valores: ${TIPOS_UNIDAD.join(", ")}` }),
    }),
    tipo: z.enum(TIPOS_VEHICULO, {
      errorMap: () => ({ message: `Tipo de vehiculo invalido. Valores: ${TIPOS_VEHICULO.join(", ")}` }),
    }).default("PROPIO"),
    mtc: optionalTrimmedString(50, "MTC"),
    mtcCarreta: optionalTrimmedString(50, "MTC carreta"),
    pesoNeto: decimalField("Peso neto"),
    pesoBruto: decimalField("Peso bruto"),
    cargaUtil: decimalField("Carga util"),
    estado: z.enum(ESTADOS_VEHICULO, {
      errorMap: () => ({ message: `Estado invalido. Valores: ${ESTADOS_VEHICULO.join(", ")}` }),
    }).default("ACTIVO"),
    propietario: propietarioSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === "SUBCONTRATADO" && !data.propietario) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar la empresa propietaria para un vehiculo subcontratado.",
        path: ["propietario"],
      });
    }

    if (data.tipo === "PROPIO" && data.propietario) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los vehiculos propios no deben llevar empresa propietaria.",
        path: ["propietario"],
      });
    }
  });

const updateVehiculoSchema = z
  .object({
    placa: z.string().trim().toUpperCase().regex(PLACA_REGEX, "Formato de placa invalido").optional(),
    placaCarreta: optionalUppercaseString(20, "Placa carreta", PLACA_REGEX, "Formato de placa carreta invalido"),
    tipoUnidad: z.enum(TIPOS_UNIDAD).optional(),
    tipo: z.enum(TIPOS_VEHICULO).optional(),
    mtc: optionalTrimmedString(50, "MTC"),
    mtcCarreta: optionalTrimmedString(50, "MTC carreta"),
    pesoNeto: decimalField("Peso neto"),
    pesoBruto: decimalField("Peso bruto"),
    cargaUtil: decimalField("Carga util"),
    estado: z.enum(ESTADOS_VEHICULO).optional(),
    propietario: propietarioSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debes enviar al menos un campo para actualizar.",
    path: ["body"],
  });

module.exports = {
  createVehiculoSchema,
  updateVehiculoSchema,
  TIPOS_UNIDAD,
  TIPOS_VEHICULO,
  ESTADOS_VEHICULO,
};
