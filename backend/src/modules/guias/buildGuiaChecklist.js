/**
 * buildGuiaChecklist.js — Construye el checklist informativo post-importación.
 *
 * El checklist es informativo: nunca bloquea la importación.
 * La verificación de vehículo en flota es optativa (se pasa como parámetro).
 */

function buildGuiaChecklist({ extractedData, vehiculoEnFlota = false }) {
  const d = extractedData;
  const warnings = [...(d.warnings ?? [])];

  const archivoValido = true;

  const datosGeneralesValidos = !!(
    d.serie &&
    d.numero &&
    d.fechaEmision
  );
  if (!datosGeneralesValidos) {
    warnings.push("Faltan datos generales clave (serie, número o fecha de emisión).");
  }

  const pagadorFletePresente = !!(d.pagadorFleteNombre || d.pagadorFleteRuc);

  const alMenosUnBien = Array.isArray(d.bienes) && d.bienes.length > 0;

  const docsRelacionadosPresentes =
    Array.isArray(d.docsRelacionados) && d.docsRelacionados.length > 0;

  return {
    archivoValido,
    datosGeneralesValidos,
    pagadorFletePresente,
    vehiculoEnFlota,
    alMenosUnBien,
    docsRelacionadosPresentes,
    origenImportacion: d.origenImportacion ?? null,
    warnings,
  };
}

module.exports = { buildGuiaChecklist };
