/**
 * parsePdfFactura.js — Parser PDF (textual, sin OCR) para Facturas Electrónicas.
 *
 * Solo funciona con PDFs digitales que contienen texto extraíble.
 * Si el texto es insuficiente o no se reconocen los campos críticos, lanza 422.
 * Agrega observación "Importado desde PDF, verificar manualmente campos sensibles".
 */

const { parseSerieNumero } = require("./parseXmlFactura");

async function parsePdfFactura(pdfBuffer) {
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
  } catch {
    throw new Error(
      "No se pudo leer el PDF. El archivo puede estar dañado o protegido."
    );
  }

  if (!text || text.trim().length < 80) {
    throw Object.assign(
      new Error(
        "El PDF no contiene texto extraíble suficiente para procesar. " +
          "Usa el XML de la factura o un ZIP que lo contenga. " +
          "Este módulo no realiza OCR."
      ),
      { statusCode: 422 }
    );
  }

  const warnings = [
    "Importado desde PDF — verificar manualmente campos sensibles antes de usar.",
    "Los montos, RUC y fecha extraídos desde PDF pueden tener imprecisiones.",
  ];

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function match(pattern, flags = "i") {
    const re = new RegExp(pattern, flags);
    const m = text.match(re);
    return m ? (m[1] ?? m[0]).trim() : null;
  }

  function matchAll(pattern, flags = "gi") {
    return [...text.matchAll(new RegExp(pattern, flags))];
  }

  function parsePeDate(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const dt = new Date(`${trimmed}T12:00:00.000Z`);
      return isNaN(dt.getTime()) ? null : dt.toISOString();
    }
    const parts = raw.split(/[\/\-]/);
    if (parts.length !== 3) return null;
    const [d, mo, y] = parts;
    if (y.length !== 4) {
      const dt = new Date(trimmed);
      return isNaN(dt.getTime()) ? null : dt.toISOString();
    }
    const dt = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00.000Z`);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  function parseAmount(str) {
    if (!str) return null;
    const clean = str.replace(/[^\d,\.]/g, "").replace(",", ".");
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  }

  // ── Serie y número ──────────────────────────────────────────────────────────
  // Patrones: "F001-00001234", "FACTURA ELECTRÓNICA F001-1234"
  const idRaw =
    match(/(?:N[°º\.o]?\s*(?:de\s*)?comprobante|N[°º]?|Número\s*)\s*:?\s*([A-Z]{1,4}\d{0,3}[\s\-]+\d{4,10})/i) ??
    match(/([A-Z]{1,4}\d{0,3}[\s]*-[\s]*\d{4,10})/);

  if (!idRaw) {
    throw Object.assign(
      new Error(
        "No se pudo extraer el número de comprobante del PDF. " +
          "Usa el XML de la factura para una importación confiable."
      ),
      { statusCode: 422 }
    );
  }

  const idCompleto = idRaw.replace(/\s+/g, "").replace(/–/g, "-");
  const { serie, numero } = parseSerieNumero(idCompleto);

  if (!serie || !numero) {
    throw Object.assign(
      new Error(`No se pudo interpretar el número "${idCompleto}" como serie-número válido.`),
      { statusCode: 422 }
    );
  }

  // ── Tipo ────────────────────────────────────────────────────────────────────
  let tipo = "FACTURA";
  if (/boleta\s+electr[oó]nica/i.test(text)) tipo = "BOLETA";
  if (/nota\s+de\s+cr[eé]dito/i.test(text)) tipo = "NOTA_CREDITO";
  if (/nota\s+de\s+d[eé]bito/i.test(text)) tipo = "NOTA_DEBITO";

  // ── Fechas ──────────────────────────────────────────────────────────────────
  const fechaRaw = match(
    /(?:Fecha\s+de\s+emisi[oó]n|Fecha\s+emisi[oó]n|F\.?\s*Emisi[oó]n)\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/
  );
  const fechaEmision = parsePeDate(fechaRaw);

  if (!fechaEmision) {
    throw Object.assign(
      new Error(
        "No se pudo extraer la fecha de emisión del PDF. " +
          "Usa el XML de la factura para una importación confiable."
      ),
      { statusCode: 422 }
    );
  }

  const fechaVencRaw = match(
    /(?:Fecha\s+de\s+vencimiento|Fecha\s+vencimiento|Vencimiento)\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/
  );
  const fechaVencimiento = parsePeDate(fechaVencRaw);

  // ── Moneda ──────────────────────────────────────────────────────────────────
  const moneda =
    match(/(?:Moneda|Currency)\s*:?\s*(PEN|USD|EUR|SOL|DOLAR|SOLES)/i)?.toUpperCase().slice(0, 3) ??
    (/soles|PEN/i.test(text) ? "PEN" : "PEN");

  // ── Cliente (receptor) ────────────────────────────────────────────────────────
  // Busca "Cliente:", "Receptor:", "Señor(es):" seguido de nombre y RUC
  let clienteNombre = null;
  let clienteRuc = null;

  // Patrón: label → nombre → RUC
  const clienteMatch = text.match(
    /(?:Cliente|Receptor|Se[ñn]or(?:es)?|Adquiriente|Comprador)\s*:?\s*([\wÁÉÍÓÚáéíóúÑñ\s\.\,\-&]{5,80}?)\s*R\.?U\.?C\.?\s*:?\s*(\d{11})/i
  );
  if (clienteMatch) {
    clienteNombre = clienteMatch[1].trim();
    clienteRuc = clienteMatch[2].trim();
  } else {
    // Patrón: RUC primero
    const rucFirst = text.match(
      /(?:Cliente|Receptor|Adquiriente)\s*:?\s*(\d{11})\s*([\wÁÉÍÓÚáéíóúÑñ\s\.\,\-&]{5,80})/i
    );
    if (rucFirst) {
      clienteRuc = rucFirst[1].trim();
      clienteNombre = rucFirst[2].trim();
    } else {
      // Buscar RUC de 11 dígitos que no sea del emisor
      const allRucs = matchAll(/\b(\d{11})\b/g);
      // El segundo RUC suele ser el del cliente (el primero es del emisor)
      if (allRucs.length >= 2) {
        clienteRuc = allRucs[1][1];
        warnings.push("RUC del cliente extraído heurísticamente del PDF. Verifique manualmente.");
      } else if (allRucs.length === 1) {
        clienteRuc = allRucs[0][1];
        warnings.push("Solo se encontró un RUC en el PDF. Podría ser el del emisor, no el cliente.");
      }
    }
  }

  if (!clienteRuc && !clienteNombre) {
    throw Object.assign(
      new Error(
        "No se pudo identificar el cliente receptor en el PDF. " +
          "Usa el XML de la factura para una importación confiable."
      ),
      { statusCode: 422 }
    );
  }

  // ── Montos ──────────────────────────────────────────────────────────────────
  const totalRaw =
    match(/(?:Importe\s+total|Total\s+a\s+pagar|TOTAL\s+IMPORTE|Total)\s*:?\s*S\/\.?\s*([\d\.,]+)/i) ??
    match(/(?:Total|Importe\s+total)\s*:?\s*([\d\.,]+)/i);
  const total = parseAmount(totalRaw);

  if (!total) {
    throw Object.assign(
      new Error(
        "No se pudo extraer el importe total del PDF. " +
          "Usa el XML de la factura para una importación confiable."
      ),
      { statusCode: 422 }
    );
  }

  const netoRaw =
    match(/(?:Valor\s+venta|Sub\s*total|Subtotal|Valor\s+neto|Base\s+imponible)\s*:?\s*S\/\.?\s*([\d\.,]+)/i) ??
    match(/(?:Subtotal|Neto)\s*:?\s*([\d\.,]+)/i);
  const montoNeto = parseAmount(netoRaw) ?? parseFloat((total / 1.18).toFixed(2));

  const igvRaw =
    match(/(?:I\.?G\.?V\.?|Impuesto\s+a\s+las\s+ventas)\s*:?\s*S\/\.?\s*([\d\.,]+)/i);
  const igv = parseAmount(igvRaw) ?? parseFloat((total - montoNeto).toFixed(2));

  // ── Detracción ───────────────────────────────────────────────────────────────
  let detraccionPorcentaje = 0;
  let detraccionMonto = 0;

  const detrPctRaw = match(/Detrac(?:ci[oó]n)?\s*(?:\(?\s*(\d{1,3}(?:\.\d+)?)\s*%?\s*\)?)/i);
  if (detrPctRaw) detraccionPorcentaje = parseFloat(detrPctRaw) || 0;

  const detrMontoRaw = match(/Detrac(?:ci[oó]n)?\s*:?\s*S\/\.?\s*([\d\.,]+)/i);
  if (detrMontoRaw) detraccionMonto = parseAmount(detrMontoRaw) ?? 0;

  if (detraccionMonto === 0 && detraccionPorcentaje > 0) {
    detraccionMonto = parseFloat(((detraccionPorcentaje / 100) * total).toFixed(2));
  }
  if (detraccionPorcentaje === 0 && detraccionMonto > 0 && total > 0) {
    detraccionPorcentaje = parseFloat(((detraccionMonto / total) * 100).toFixed(2));
  }

  // ── Forma de pago ────────────────────────────────────────────────────────────
  const formaPago =
    match(/(?:Forma\s+de\s+pago|Condici[oó]n\s+de\s+pago)\s*:?\s*([^\n\r]{3,40})/i) ?? null;

  // ── Guías relacionadas ────────────────────────────────────────────────────────
  const guiasRelacionadas = [];
  const seenGuias = new Set();

  const guiaMatches = matchAll(/\b([A-Z]{1,4}\d{0,3})-(\d{4,10})\b/);
  for (const m of guiaMatches) {
    const sG = m[1];
    const nG = m[2];
    // Filtrar la propia factura
    if (sG === serie && nG === numero) continue;
    // Solo incluir si parece guía (T, E, V, etc.) – no si parece otro comprobante
    const key = `${sG}-${nG}`;
    if (!seenGuias.has(key)) {
      seenGuias.add(key);
      guiasRelacionadas.push({ serieGuia: sG, numeroGuia: nG });
    }
  }

  if (guiasRelacionadas.length === 0) {
    warnings.push("No se encontraron guías de remisión relacionadas en el PDF.");
  }

  return {
    idCompleto,
    serie,
    numero,
    tipo,
    fechaEmision,
    fechaVencimiento,
    moneda,
    clienteNombre,
    clienteRuc,
    emisorNombre: null,
    emisorRuc: null,
    montoNeto,
    igv,
    total,
    detraccionPorcentaje,
    detraccionMonto,
    formaPago,
    guiasRelacionadas,
    warnings,
  };
}

module.exports = { parsePdfFactura };
