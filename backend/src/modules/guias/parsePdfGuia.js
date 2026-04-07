/**
 * parsePdfGuia.js — Parser PDF (secundario) para Guías de Remisión SUNAT.
 *
 * Solo funciona con PDFs textuales/digitales. No usa OCR.
 * Si el PDF no tiene texto suficiente, lanza error con mensaje claro.
 *
 * Retorna los mismos campos que parseXmlGuia pero con confianza menor.
 * Campos no extraídos se devuelven como null con warnings.
 */

async function parsePdfGuia(pdfBuffer) {
  let pdfParse;
  try {
    pdfParse = require("pdf-parse");
  } catch {
    throw new Error(
      "Librería pdf-parse no disponible. Instala con: npm install pdf-parse"
    );
  }

  let text;
  try {
    const data = await pdfParse(pdfBuffer);
    text = data.text ?? "";
  } catch (err) {
    throw new Error(
      "No se pudo leer el PDF. El archivo puede estar dañado o protegido."
    );
  }

  if (!text || text.trim().length < 50) {
    throw new Error(
      "El PDF no es textual o no tiene un formato soportado. " +
        "Importa el XML o un ZIP que lo contenga."
    );
  }

  const warnings = [
    "Importado desde PDF — algunos campos pueden ser imprecisos. Revisa los datos antes de guardar.",
  ];

  // ── Helpers de extracción ──────────────────────────────────────────────────
  function match(pattern, flags = "i") {
    const re = new RegExp(pattern, flags);
    const m = text.match(re);
    return m ? (m[1] ?? m[0]).trim() : null;
  }

  function matchAll(pattern, flags = "gi") {
    const re = new RegExp(pattern, flags);
    return [...text.matchAll(re)];
  }

  // ── Serie y número ──────────────────────────────────────────────────────────
  // Patrones comunes en PDFs de SUNAT: "EG03-10453" o "EG03 - 00010453"
  const idRaw = match(
    /(?:Nro\.?\s*de\s*(?:Guía|Remisión)|Número|Serie[-\s:]+N[°o]?|N[°o]?)\s*:?\s*([A-Z0-9]{2,6}\s*[-–]\s*\d+)/i
  ) ?? match(/([A-Z]{1,4}\d{1,3}\s*[-–]\s*\d{4,10})/);
  const idCompleto = idRaw;

  // ── Fechas ──────────────────────────────────────────────────────────────────
  // Formato peruano: DD/MM/YYYY o DD-MM-YYYY
  const fechaRaw = match(
    /(?:Fecha\s*de\s*[Ee]misión|Fecha\s*emisi[oó]n)\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/
  );
  let fechaEmision = null;
  if (fechaRaw) {
    const parts = fechaRaw.split(/[\/\-]/);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const dt = new Date(`${y}-${m}-${d}`);
      fechaEmision = isNaN(dt.getTime()) ? null : dt.toISOString();
    }
  }
  if (!fechaEmision) warnings.push("No se pudo extraer la fecha de emisión del PDF.");

  const horaEmision =
    match(/(?:Hora\s*de\s*emisión|Hora)\s*:?\s*(\d{2}:\d{2}(?::\d{2})?)/) ?? null;

  // Fecha inicio traslado
  const fechaInicioRaw = match(
    /(?:Fecha\s*de\s*inicio\s*de\s*traslado|Inicio\s*traslado)\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/
  );
  let fechaInicioTraslado = null;
  if (fechaInicioRaw) {
    const parts = fechaInicioRaw.split(/[\/\-]/);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const dt = new Date(`${y}-${m}-${d}`);
      fechaInicioTraslado = isNaN(dt.getTime()) ? null : dt.toISOString();
    }
  }

  // ── RUC/razón social helpers ─────────────────────────────────────────────────
  function extractParty(labelPattern) {
    const re = new RegExp(
      labelPattern + "\\s*:?\\s*([\\w\\s\\.\\,\\-&]+)\\s*RUC\\s*:?\\s*(\\d{11})",
      "i"
    );
    const m = text.match(re);
    if (m) return { nombre: m[1].trim(), ruc: m[2].trim() };

    // Alternativa: RUC primero
    const re2 = new RegExp(
      labelPattern + "\\s*:?\\s*(\\d{11})[\\s\\-]+([\\w\\s\\.\\,\\-&]+)",
      "i"
    );
    const m2 = text.match(re2);
    if (m2) return { ruc: m2[1].trim(), nombre: m2[2].trim() };

    return { nombre: null, ruc: null };
  }

  const transportista = extractParty("(?:Transportista|Empresa de transporte)");
  const remitente = extractParty("Remitente");
  const destinatario = extractParty("Destinatario");
  const pagador = extractParty("(?:Pagador del flete|Pagador)");

  // ── Puntos ──────────────────────────────────────────────────────────────────
  const puntoDeSalida =
    match(/(?:Punto\s*de\s*(?:salida|origen)|Origen)\s*:?\s*([^\n\r]{5,80})/) ?? null;
  const puntoDeLlegada =
    match(/(?:Punto\s*de\s*llegada|Destino)\s*:?\s*([^\n\r]{5,80})/) ?? null;

  // ── Placa ───────────────────────────────────────────────────────────────────
  const placaMatches = matchAll(/\b([A-Z0-9]{3}-\d{3}|[A-Z]{3}\d{3}|[A-Z]{2}\d[A-Z]{2}|\d{3}-[A-Z]{3})\b/);
  const placas = placaMatches.map((m) => m[1]).filter(Boolean);
  const placaPrincipal = placas[0] ?? null;
  const placaSecundaria = placas[1] ?? null;

  // ── Conductor ───────────────────────────────────────────────────────────────
  const conductorPrincipalDocumento =
    match(/(?:DNI|Documento)\s*(?:del\s*conductor)?\s*:?\s*(\d{8})/) ?? null;
  const conductorPrincipalNombre =
    match(/(?:Conductor|Chofer)\s*:?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]{5,60})/) ?? null;
  const conductorPrincipalLicencia =
    match(/(?:Licencia|MTC|Lic\.)\s*:?\s*([A-Z0-9\-]{4,20})/) ?? null;

  // ── Peso ────────────────────────────────────────────────────────────────────
  const pesoRaw = match(
    /(?:Peso\s*bruto\s*total|Peso\s*total|Peso)\s*:?\s*([\d\.,]+)\s*(KGM|TN|KG|TON)?/i
  );
  let pesoBrutoTotal = null;
  let unidadPeso = null;
  if (pesoRaw) {
    pesoBrutoTotal = parseFloat(pesoRaw.replace(",", ".")) || null;
    unidadPeso = null; // extraer de siguiente match si existe
  }

  // ── Bienes ──────────────────────────────────────────────────────────────────
  // Los bienes en PDF son difíciles de extraer con certeza → devolver vacío con warning
  const bienes = [];
  warnings.push(
    "La extracción de bienes desde PDF no es confiable. Verifica manualmente si es necesario."
  );

  // ── Observación SUNAT ────────────────────────────────────────────────────────
  const observacionSunat =
    match(/(?:Observaci[oó]n|Observaciones)\s*:?\s*([^\n\r]{5,300})/) ?? null;

  if (!idCompleto) warnings.push("No se pudo extraer el número de guía del PDF.");

  return {
    idCompleto,
    fechaEmision,
    horaEmision,
    fechaInicioTraslado,
    transportistaRuc: transportista.ruc,
    transportistaNombre: transportista.nombre,
    remitenteRuc: remitente.ruc,
    remitenteNombre: remitente.nombre,
    destinatarioRuc: destinatario.ruc,
    destinatarioNombre: destinatario.nombre,
    pagadorFleteRuc: pagador.ruc,
    pagadorFleteNombre: pagador.nombre,
    puntoDeSalida,
    puntoDeLlegada,
    pesoBrutoTotal,
    unidadPeso,
    placaPrincipal,
    placaSecundaria,
    conductorPrincipalDocumento,
    conductorPrincipalNombre,
    conductorPrincipalLicencia,
    subcontratistaRuc: null,
    subcontratistaNombre: null,
    transbordo: false,
    retornoVacio: false,
    subcontratado: false,
    observacionSunat,
    docsRelacionados: [],
    bienes,
    warnings,
  };
}

module.exports = { parsePdfGuia };
