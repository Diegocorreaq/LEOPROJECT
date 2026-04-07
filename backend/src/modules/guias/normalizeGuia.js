/**
 * normalizeGuia.js — Normaliza serie y número para detección robusta de duplicados.
 *
 * Ejemplos:
 *   "EG03-10453"        → { serie: "EG03", numero: "10453" }
 *   "EG03 - 00010453"   → { serie: "EG03", numero: "10453" }
 *   "T001-00000123"     → { serie: "T001", numero: "123" }
 */

function normalizeSerieNumero(rawId) {
  if (!rawId) return { serie: null, numero: null };

  // Quitar espacios y pasar a uppercase
  const cleaned = String(rawId).trim().toUpperCase().replace(/\s+/g, "");

  // Separar en serie y número por los guiones
  const idx = cleaned.indexOf("-");
  if (idx === -1) return { serie: cleaned, numero: null };

  const serie = cleaned.slice(0, idx).trim();
  const rawNum = cleaned.slice(idx + 1).replace(/-/g, ""); // quitar guiones extra

  // Quitar ceros a la izquierda (formato visual PDF vs XML)
  const numInt = parseInt(rawNum, 10);
  const numero = isNaN(numInt) ? rawNum : String(numInt);

  return { serie, numero };
}

module.exports = { normalizeSerieNumero };
