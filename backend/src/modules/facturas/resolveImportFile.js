/**
 * resolveImportFile.js (facturas) — Resuelve archivo individual a parsear.
 *
 * Individual: acepta XML, ZIP→XML, ZIP→PDF, PDF.
 * ZIP prioriza XML sobre PDF.
 */

const AdmZip = require("adm-zip");

function resolveImportFile(fileBuffer, originalName) {
  const ext = originalName.split(".").pop().toLowerCase();

  if (ext === "xml") {
    return { type: "XML", buffer: fileBuffer, filename: originalName, sourceType: "XML" };
  }

  if (ext === "pdf") {
    return { type: "PDF", buffer: fileBuffer, filename: originalName, sourceType: "PDF" };
  }

  if (ext === "zip") {
    let zip;
    try {
      zip = new AdmZip(fileBuffer);
    } catch {
      throw new Error("El archivo ZIP no pudo ser leído o está dañado.");
    }

    const entries = zip.getEntries().filter((e) => !e.isDirectory);

    const xmlEntry = entries.find((e) => e.entryName.toLowerCase().endsWith(".xml"));
    if (xmlEntry) {
      return {
        type: "XML",
        buffer: xmlEntry.getData(),
        filename: xmlEntry.entryName,
        sourceType: "ZIP_XML",
      };
    }

    const pdfEntry = entries.find((e) => e.entryName.toLowerCase().endsWith(".pdf"));
    if (pdfEntry) {
      return {
        type: "PDF",
        buffer: pdfEntry.getData(),
        filename: pdfEntry.entryName,
        sourceType: "ZIP_PDF",
      };
    }

    throw new Error("El ZIP no contiene ningún archivo XML o PDF válido.");
  }

  throw new Error("Formato no soportado. Sube un archivo .xml, .zip o .pdf.");
}

/**
 * Extrae todos los XML de un ZIP para importación masiva.
 * Devuelve array de { buffer, filename }.
 * Lanza error si el ZIP no contiene XML válidos.
 * No acepta PDF en modo masivo.
 */
function resolveZipXmlEntries(zipBuffer, zipName) {
  let zip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    throw new Error(`El archivo "${zipName}" no pudo ser leído o está dañado.`);
  }

  const entries = zip
    .getEntries()
    .filter((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".xml"));

  if (entries.length === 0) {
    throw new Error(`El ZIP "${zipName}" no contiene archivos XML válidos.`);
  }

  return entries.map((e) => ({
    buffer: e.getData(),
    filename: e.entryName,
  }));
}

module.exports = { resolveImportFile, resolveZipXmlEntries };
