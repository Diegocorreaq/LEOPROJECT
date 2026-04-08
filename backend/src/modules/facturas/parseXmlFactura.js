/**
 * parseXmlFactura.js — Parser XML para Facturas Electrónicas SUNAT (UBL Invoice).
 *
 * Tolerante a nodos faltantes. Lanza error solo si faltan campos críticos:
 *  - ID (serie-numero)
 *  - IssueDate (fecha emisión)
 *  - AccountingCustomerParty (cliente receptor)
 *  - PayableAmount (total)
 */

const { XMLParser } = require("fast-xml-parser");

// ── Helpers ───────────────────────────────────────────────────────────────────

function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function nodeText(node) {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const t = nodeText(item);
      if (t != null) return t;
    }
    return null;
  }
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    const text = String(node).trim();
    return text || null;
  }
  if (typeof node === "object") {
    for (const key of ["#text", "$text", "_text", "__text", "value"]) {
      const t = nodeText(node[key]);
      if (t != null) return t;
    }
    return null;
  }
  return null;
}

function safeStr(val) {
  return nodeText(val);
}

function safeDate(val) {
  const raw = nodeText(val);
  if (!raw) return null;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function safeDecimal(val) {
  const raw = nodeText(val);
  if (raw == null) return null;
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) ? null : n;
}

function partyNode(node) {
  return node?.Party ?? node ?? null;
}

function partyId(node) {
  const p = partyNode(node);
  return (
    safeStr(p?.PartyIdentification?.ID) ??
    safeStr(p?.PartyTaxScheme?.CompanyID) ??
    null
  );
}

function partyName(node) {
  const p = partyNode(node);
  return (
    safeStr(p?.PartyLegalEntity?.RegistrationName) ??
    safeStr(p?.PartyName?.Name) ??
    null
  );
}

// Extrae serie y número desde el ID completo de la factura ("F001-00001234")
function parseSerieNumero(id) {
  if (!id) return { serie: null, numero: null };
  const m = id.match(/^([A-Z][A-Z0-9]{0,3})-(\d+)$/);
  if (m) return { serie: m[1], numero: m[2] };
  // Fallback: dividir en el primer guión
  const idx = id.indexOf("-");
  if (idx > 0) {
    return { serie: id.slice(0, idx), numero: id.slice(idx + 1) };
  }
  return { serie: null, numero: id };
}

// ── Parser principal ──────────────────────────────────────────────────────────

function parseXmlFactura(xmlBuffer) {
  const warnings = [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    isArray: (name) =>
      [
        "TaxTotal",
        "TaxSubtotal",
        "DespatchDocumentReference",
        "AdditionalDocumentReference",
        "InvoiceLine",
        "AllowanceCharge",
        "PaymentTerms",
        "PaymentMeans",
        "Note",
      ].includes(name),
    parseTagValue: false,
    trimValues: true,
  });

  let doc;
  try {
    doc = parser.parse(xmlBuffer.toString("utf8"));
  } catch (err) {
    throw new Error(`XML inválido: ${err.message}`);
  }

  // Root: Invoice u otro nombre
  const root =
    doc?.Invoice ??
    doc?.["ext:Invoice"] ??
    Object.values(doc || {}).find((v) => v && typeof v === "object") ??
    doc;

  if (!root || typeof root !== "object") {
    throw new Error("XML sin estructura válida de Invoice (SUNAT UBL).");
  }

  // ── ID completo ──────────────────────────────────────────────────────────────
  const idCompleto = safeStr(root.ID);
  if (!idCompleto) {
    throw new Error(
      "El XML no contiene el número de comprobante (cbc:ID). Verifica el archivo."
    );
  }

  const { serie, numero } = parseSerieNumero(idCompleto);
  if (!serie || !numero) {
    throw new Error(
      `No se pudo extraer serie y número del ID "${idCompleto}". Formato esperado: F001-12345.`
    );
  }

  // ── Tipo de documento ────────────────────────────────────────────────────────
  const tipoCode = safeStr(root.InvoiceTypeCode) ?? "01";
  const TIPOS = { "01": "FACTURA", "03": "BOLETA", "07": "NOTA_CREDITO", "08": "NOTA_DEBITO" };
  const tipo = TIPOS[tipoCode] ?? `COMPROBANTE_${tipoCode}`;

  // ── Fechas ──────────────────────────────────────────────────────────────────
  const fechaEmision = safeDate(root.IssueDate);
  if (!fechaEmision) {
    throw new Error("El XML no contiene la fecha de emisión (cbc:IssueDate).");
  }

  const fechaVencimiento =
    safeDate(root.DueDate) ??
    safeDate(root.PaymentDueDate) ??
    null;

  // ── Moneda ──────────────────────────────────────────────────────────────────
  const moneda = safeStr(root.DocumentCurrencyCode) ?? "PEN";

  // ── Cliente receptor (AccountingCustomerParty) ───────────────────────────────
  const customerNode = root.AccountingCustomerParty;
  if (!customerNode) {
    throw new Error(
      "El XML no contiene el cliente receptor (cac:AccountingCustomerParty). No se puede identificar al cliente."
    );
  }

  const clienteRuc = partyId(customerNode);
  const clienteNombre = partyName(customerNode);

  if (!clienteRuc && !clienteNombre) {
    throw new Error(
      "No se pudo extraer el RUC ni la razón social del cliente receptor."
    );
  }

  if (!clienteRuc) {
    warnings.push("No se encontró el RUC del cliente receptor. Se usará la razón social para búsqueda.");
  }
  if (!clienteNombre) {
    warnings.push("No se encontró la razón social del cliente receptor.");
  }

  // ── Emisor (AccountingSupplierParty) ────────────────────────────────────────
  const supplierNode = root.AccountingSupplierParty;
  const emisorRuc = partyId(supplierNode) ?? null;
  const emisorNombre = partyName(supplierNode) ?? null;

  // ── Montos ──────────────────────────────────────────────────────────────────
  const monetaryTotal = root.LegalMonetaryTotal ?? root.RequestedMonetaryTotal ?? {};

  const montoNeto =
    safeDecimal(monetaryTotal.LineExtensionAmount) ??
    safeDecimal(monetaryTotal.TaxExclusiveAmount) ??
    0;

  const total =
    safeDecimal(monetaryTotal.PayableAmount) ??
    safeDecimal(monetaryTotal.TaxInclusiveAmount) ??
    null;

  if (total == null) {
    throw new Error(
      "El XML no contiene el importe total (cac:LegalMonetaryTotal/cbc:PayableAmount)."
    );
  }

  // ── IGV (TaxTotal → TaxSubtotal con código 1000) ─────────────────────────────
  let igv = 0;
  const taxTotals = toArray(root.TaxTotal);
  for (const tt of taxTotals) {
    const subtotals = toArray(tt.TaxSubtotal);
    for (const sub of subtotals) {
      const taxCode = safeStr(sub?.TaxCategory?.TaxScheme?.ID);
      if (!taxCode || taxCode === "1000" || taxCode === "IGV") {
        const amount = safeDecimal(sub.TaxAmount);
        if (amount != null) { igv = amount; break; }
      }
    }
    if (igv > 0) break;
    // Fallback: primer TaxTotal total
    const firstTax = safeDecimal(tt.TaxAmount);
    if (firstTax != null && igv === 0) igv = firstTax;
  }

  // ── Detracción (PaymentMeans o extensión SUNAT) ──────────────────────────────
  let detraccionPorcentaje = 0;
  let detraccionMonto = 0;

  const paymentMeansList = toArray(root.PaymentMeans);
  for (const pm of paymentMeansList) {
    const code = safeStr(pm.PaymentMeansCode) ?? safeStr(pm.InstructionID);
    if (code === "Detraccion" || code === "Detracc" || /detrac/i.test(code ?? "")) {
      detraccionMonto = safeDecimal(pm.InstructionNote) ?? safeDecimal(pm.Amount) ?? 0;
      break;
    }
  }

  // Buscar en extensiones UBL (SUNATTransaction)
  const extContent = root?.UBLExtensions?.UBLExtension?.ExtensionContent ?? {};
  const sunatTx = extContent?.SUNATTransaction ?? extContent?.SUNATEmbededDespatchAdvice ?? {};
  if (sunatTx) {
    const pcDet = safeDecimal(sunatTx.SUNATPaymentTerms?.PaymentPercent);
    const mDet = safeDecimal(sunatTx.SUNATPaymentTerms?.Amount);
    if (pcDet != null) detraccionPorcentaje = pcDet;
    if (mDet != null) detraccionMonto = mDet;
  }

  // Fallback: calcular porcentaje si tenemos monto y total
  if (detraccionPorcentaje === 0 && detraccionMonto > 0 && total > 0) {
    detraccionPorcentaje = parseFloat(((detraccionMonto / total) * 100).toFixed(2));
  }

  // ── Forma de pago (PaymentTerms) ─────────────────────────────────────────────
  let formaPago = null;
  const paymentTermsList = toArray(root.PaymentTerms);
  for (const pt of paymentTermsList) {
    const id = safeStr(pt.ID);
    const note = safeStr(pt.Note);
    if (id === "FormaPago" || note) {
      formaPago = note ?? id;
      break;
    }
  }
  if (!formaPago && paymentTermsList.length > 0) {
    formaPago = safeStr(paymentTermsList[0]?.PaymentMeansID) ?? null;
  }

  // ── Guías relacionadas (DespatchDocumentReference) ───────────────────────────
  const despatchRefs = toArray(root.DespatchDocumentReference);
  const additionalRefs = toArray(root.AdditionalDocumentReference);

  const guiasRelacionadas = [];
  const seenGuias = new Set();

  function addGuia(idStr) {
    if (!idStr) return;
    const m = idStr.match(/([A-Z][A-Z0-9]{1,3})-(\d+)/);
    if (!m) return;
    const key = `${m[1]}-${m[2]}`;
    if (seenGuias.has(key)) return;
    seenGuias.add(key);
    guiasRelacionadas.push({ serieGuia: m[1], numeroGuia: m[2] });
  }

  for (const ref of despatchRefs) {
    addGuia(safeStr(ref.ID));
  }
  for (const ref of additionalRefs) {
    const typeCode = safeStr(ref.DocumentTypeCode) ?? safeStr(ref.DocumentType) ?? "";
    // "09" = guía de remisión en SUNAT
    if (typeCode === "09" || /guia/i.test(typeCode)) {
      addGuia(safeStr(ref.ID));
    }
  }

  // Buscar en Notes menciones de guías
  const notes = toArray(root.Note);
  for (const note of notes) {
    const text = safeStr(note) ?? "";
    const re = /\b([A-Z]{1,4}\d{0,3})-(\d{4,10})\b/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[1].startsWith("E") || m[1].startsWith("G") || m[1].startsWith("T")) {
        addGuia(`${m[1]}-${m[2]}`);
      }
    }
  }

  if (guiasRelacionadas.length === 0) {
    warnings.push("No se encontraron guías de remisión relacionadas en el XML.");
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
    emisorNombre,
    emisorRuc,
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

module.exports = { parseXmlFactura, parseSerieNumero };
