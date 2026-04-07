// validate.js - Helper Zod v4 compatible (usa .issues no .errors)
function validate(schema, data, res) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = Array.isArray(result.error.issues) ? result.error.issues : [];
    const errors = issues.map(function(e) {
      return { campo: (e.path || []).join(".") || "body", mensaje: e.message };
    });
    res.status(400).json({ error: "Datos de entrada invalidos", detalles: errors });
    return null;
  }
  return result.data;
}
module.exports = { validate };
