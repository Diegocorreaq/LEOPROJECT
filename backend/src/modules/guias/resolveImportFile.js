/**
 * resolveImportFile.js — Resuelve el archivo a parsear desde XML, ZIP o PDF.
 *
 * Prioridad en ZIP: XML > PDF.
 * Devuelve: { type: 'XML'|'PDF', buffer, filename, sourceType }
 */

const AdmZip = require("adm-zip");

function resolveImportFile(fileBuffer, originalName) {
  const ext = originalName.split(".").pop().toLowerCase();

  if (ext === "xml") {
    return {
      type: "XML",
      buffer: fileBuffer,
      filename: originalName,
      sourceType: "XML",
    };
  }

  if (ext === "pdf") {
    return {
      type: "PDF",
      buffer: fileBuffer,
      filename: originalName,
      sourceType: "PDF",
    };
  }

  if (ext === "zip") {
    let zip;
    try {
      zip = new AdmZip(fileBuffer);
    } catch {
      throw new Error("El archivo ZIP no pudo ser leído o está dañado.");
    }

    const entries = zip.getEntries().filter((e) => !e.isDirectory);

    // Preferir XML
    const xmlEntry = entries.find((e) =>
      e.entryName.toLowerCase().endsWith(".xml")
    );
    if (xmlEntry) {
      return {
        type: "XML",
        buffer: xmlEntry.getData(),
        filename: xmlEntry.entryName,
        sourceType: "ZIP_XML",
      };
    }

    // Fallback a PDF
    const pdfEntry = entries.find((e) =>
      e.entryName.toLowerCase().endsWith(".pdf")
    );
    if (pdfEntry) {
      return {
        type: "PDF",
        buffer: pdfEntry.getData(),
        filename: pdfEntry.entryName,
        sourceType: "ZIP_PDF",
      };
    }

    throw new Error(
      "El ZIP no contiene ningún archivo XML o PDF válido."
    );
  }

  throw new Error(
    "Formato no soportado. Sube un archivo .xml, .zip o .pdf."
  );
}

module.exports = { resolveImportFile };
