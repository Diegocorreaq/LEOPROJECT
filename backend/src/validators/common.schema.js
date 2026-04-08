const { z } = require("zod");

function trimString(value) {
  return typeof value === "string" ? value.trim() : value;
}

function emptyToUndefined(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function uuidField(label = "id") {
  return z
    .string({ required_error: `${label} es requerido` })
    .trim()
    .uuid(`${label} debe ser un UUID valido`);
}

const idParamSchema = z.object({ id: uuidField("id") }).strict();

function booleanQueryField(label) {
  return z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (normalized === undefined) return undefined;
    if (normalized === true || normalized === "true" || normalized === "1") return true;
    if (normalized === false || normalized === "false" || normalized === "0") return false;
    return normalized;
  }, z.boolean({ invalid_type_error: `${label} debe ser true o false` }).optional());
}

function intQueryField(label, { min = 1, max = 100, defaultValue } = {}) {
  const base = z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (normalized === undefined) return defaultValue;
    return normalized;
  }, z.coerce.number().int(`${label} debe ser un entero`).min(min).max(max));

  return defaultValue === undefined ? base.optional() : base;
}

function stringQueryField(label, { max = 200 } = {}) {
  return z.preprocess(
    (value) => emptyToUndefined(trimString(value)),
    z.string().max(max, `${label} demasiado largo`).optional(),
  );
}

function enumQueryField(values, label) {
  return z.preprocess(
    (value) => {
      const normalized = emptyToUndefined(trimString(value));
      return typeof normalized === "string" ? normalized.toUpperCase() : normalized;
    },
    z.enum(values, {
      errorMap: () => ({ message: `${label} invalido. Valores: ${values.join(", ")}` }),
    }).optional(),
  );
}

function uuidQueryField(label) {
  return z.preprocess((value) => emptyToUndefined(trimString(value)), uuidField(label).optional());
}

function isoDateQueryField(label) {
  return z.preprocess(
    (value) => emptyToUndefined(trimString(value)),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} debe tener formato YYYY-MM-DD`)
      .optional(),
  );
}

const paginationQuerySchema = z.object({
  page: intQueryField("page", { min: 1, max: 100000, defaultValue: 1 }),
  limit: intQueryField("limit", { min: 1, max: 100, defaultValue: 25 }),
}).strict();

module.exports = {
  booleanQueryField,
  enumQueryField,
  idParamSchema,
  intQueryField,
  isoDateQueryField,
  paginationQuerySchema,
  stringQueryField,
  uuidField,
  uuidQueryField,
};
