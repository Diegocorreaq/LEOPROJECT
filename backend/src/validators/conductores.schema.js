const { z } = require("zod");

const TIPOS_DOCUMENTO = ["DNI", "CE", "PASAPORTE", "RUC"];
const TIPOS_CONDUCTOR = ["PROPIO", "SUBCONTRATADO"];

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

const createConductorSchema = z
  .object({
    nombre: z.string({ required_error: "El nombre es requerido" }).trim().min(2, "Nombre demasiado corto").max(100, "Nombre demasiado largo"),
    apPaterno: z.string({ required_error: "El apellido paterno es requerido" }).trim().min(2, "Apellido paterno demasiado corto").max(100, "Apellido paterno demasiado largo"),
    apMaterno: optionalTrimmedString(100, "Apellido materno"),
    tipoDocumento: z.enum(TIPOS_DOCUMENTO, {
      errorMap: () => ({ message: `Tipo de documento invalido. Valores: ${TIPOS_DOCUMENTO.join(", ")}` }),
    }),
    nroDocumento: z.string({ required_error: "El numero de documento es requerido" }).trim().min(6, "Numero de documento demasiado corto").max(20, "Numero de documento demasiado largo"),
    licencia: optionalTrimmedString(20, "Licencia"),
    tipo: z.enum(TIPOS_CONDUCTOR, {
      errorMap: () => ({ message: `Tipo de conductor invalido. Valores: ${TIPOS_CONDUCTOR.join(", ")}` }),
    }).default("PROPIO"),
    activo: z.boolean().optional().default(true),
    propietario: propietarioSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === "SUBCONTRATADO" && !data.propietario) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar la empresa propietaria para un conductor subcontratado.",
        path: ["propietario"],
      });
    }

    if (data.tipo === "PROPIO" && data.propietario) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los conductores propios no deben llevar empresa propietaria.",
        path: ["propietario"],
      });
    }

    if (data.tipoDocumento === "DNI" && !/^\d{8}$/.test(data.nroDocumento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El DNI debe tener exactamente 8 digitos.",
        path: ["nroDocumento"],
      });
    }

    if (data.tipoDocumento === "RUC" && !/^\d{11}$/.test(data.nroDocumento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El RUC debe tener exactamente 11 digitos.",
        path: ["nroDocumento"],
      });
    }
  });

const updateConductorSchema = z
  .object({
    nombre: z.string().trim().min(2, "Nombre demasiado corto").max(100, "Nombre demasiado largo").optional(),
    apPaterno: z.string().trim().min(2, "Apellido paterno demasiado corto").max(100, "Apellido paterno demasiado largo").optional(),
    apMaterno: optionalTrimmedString(100, "Apellido materno"),
    tipoDocumento: z.enum(TIPOS_DOCUMENTO).optional(),
    nroDocumento: z.string().trim().min(6, "Numero de documento demasiado corto").max(20, "Numero de documento demasiado largo").optional(),
    licencia: optionalTrimmedString(20, "Licencia"),
    tipo: z.enum(TIPOS_CONDUCTOR).optional(),
    activo: z.boolean().optional(),
    propietario: propietarioSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!Object.values(data).some((value) => value !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes enviar al menos un campo para actualizar.",
        path: ["body"],
      });
    }

    if (data.tipoDocumento === "DNI" && data.nroDocumento && !/^\d{8}$/.test(data.nroDocumento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El DNI debe tener exactamente 8 digitos.",
        path: ["nroDocumento"],
      });
    }

    if (data.tipoDocumento === "RUC" && data.nroDocumento && !/^\d{11}$/.test(data.nroDocumento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El RUC debe tener exactamente 11 digitos.",
        path: ["nroDocumento"],
      });
    }
  });

module.exports = {
  createConductorSchema,
  updateConductorSchema,
  TIPOS_DOCUMENTO,
  TIPOS_CONDUCTOR,
};
