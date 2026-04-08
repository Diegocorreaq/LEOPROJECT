function formatIssues(error, source) {
  const issues = Array.isArray(error?.issues) ? error.issues : [];
  return issues.map((issue) => ({
    campo: [source, ...(issue.path || [])].filter(Boolean).join(".") || source,
    mensaje: issue.message,
  }));
}

function validate(schema, data, res, source = "body") {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({
      error: "Datos de entrada invalidos",
      detalles: formatIssues(result.error, source),
    });
    return null;
  }

  return result.data;
}

function validateRequest(schemas, req, res) {
  const parsed = {};

  for (const [source, schema] of Object.entries(schemas)) {
    if (!schema) continue;
    const value = validate(schema, req[source], res, source);
    if (!value) return null;
    parsed[source] = value;
  }

  return parsed;
}

module.exports = {
  validate,
  validateRequest,
};
