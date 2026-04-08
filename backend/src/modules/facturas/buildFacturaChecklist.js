/**
 * buildFacturaChecklist.js — Checklist informativo post-importación de factura.
 * Nunca bloquea la importación.
 */

function buildFacturaChecklist({ extracted, clienteResuelto, servicioSugerido = false }) {
  const d = extracted;
  const warnings = [...(d.warnings ?? [])];

  const archivoValido = true;

  const datosGeneralesValidos = !!(d.serie && d.numero && d.fechaEmision);
  if (!datosGeneralesValidos) {
    warnings.push("Faltan datos generales clave (serie, número o fecha de emisión).");
  }

  const totalPresente = d.total != null && d.total > 0;
  if (!totalPresente) warnings.push("No se pudo determinar el importe total.");

  const clienteIdentificado = !!(d.clienteRuc || d.clienteNombre);
  if (!clienteIdentificado) warnings.push("No se pudo identificar el cliente receptor.");

  const guiasRelacionadasPresentes =
    Array.isArray(d.guiasRelacionadas) && d.guiasRelacionadas.length > 0;

  if (!guiasRelacionadasPresentes) {
    warnings.push("No se encontraron guías de remisión relacionadas.");
  }

  return {
    archivoValido,
    datosGeneralesValidos,
    totalPresente,
    clienteIdentificado,
    clienteResuelto: !!clienteResuelto,
    guiasRelacionadasPresentes,
    servicioSugerido,
    warnings,
  };
}

module.exports = { buildFacturaChecklist };
