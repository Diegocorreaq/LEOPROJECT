/**
 * parseXmlFactura.js - Parser XML para facturas electronicas SUNAT (UBL Invoice).
 *
 * Tolerante a nodos faltantes. Lanza error solo si faltan campos criticos:
 *  - ID (serie-numero)
 *  - IssueDate (fecha emision)
 *  - AccountingCustomerParty (cliente receptor)
 *  - PayableAmount (total)
 */

const { XMLParser } = require("fast-xml-parser");

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function nodeText(node) {
  if (node == null) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const text = nodeText(item);
      if (text != null) return text;
    }
    return null;
  }

  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    const text = String(node).trim();
    return text || null;
  }

  if (typeof node === "object") {
    for (const key of ["#text", "$text", "_text", "__text", "value"]) {
      const text = nodeText(node[key]);
      if (text != null) return text;
    }
    return null;
  }

  return null;
}

function safeStr(value) {
  return nodeText(value);
}

function safeDate(value) {
  const raw = nodeText(value);
  if (!raw) return null;

  try {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
}

function safeDecimal(value) {
  const raw = nodeText(value);
  if (raw == null) return null;

  const parsed = parseFloat(raw.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function partyNode(node) {
  return node?.Party ?? node ?? null;
}

function partyId(node) {
  const party = partyNode(node);
  return safeStr(party?.PartyIdentification?.ID) ?? safeStr(party?.PartyTaxScheme?.CompanyID) ?? null;
}

function partyName(node) {
  const party = partyNode(node);
  return safeStr(party?.PartyLegalEntity?.RegistrationName) ?? safeStr(party?.PartyName?.Name) ?? null;
}

function normalizeUpperText(value) {
  if (value == null) return null;

  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  return normalized || null;
}

function normalizeDocRef(value) {
  if (value == null) return null;

  const normalized = String(value)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim()
    .toUpperCase();

  return normalized || null;
}

function normalizeNumericId(value) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return raw || null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? raw : String(parsed);
}

function parseSerieNumero(id) {
  if (!id) return { serie: null, numero: null };

  const normalizedId = normalizeDocRef(id) ?? String(id).trim().toUpperCase();
  const match = normalizedId.match(/^([A-Z][A-Z0-9]{0,3})-(\d+)$/);
  if (match) return { serie: match[1], numero: match[2] };

  const separatorIndex = normalizedId.indexOf("-");
  if (separatorIndex > 0) {
    return {
      serie: normalizedId.slice(0, separatorIndex),
      numero: normalizedId.slice(separatorIndex + 1),
    };
  }

  return { serie: null, numero: normalizedId };
}

function parseGuiaRef(value) {
  const normalized = normalizeDocRef(value);
  if (!normalized) return null;

  const match = normalized.match(/^([A-Z][A-Z0-9]{1,3})-(\d{1,12})$/i);
  if (!match) return null;

  return {
    serieGuia: match[1].toUpperCase(),
    numeroGuia: normalizeNumericId(match[2]) ?? match[2],
  };
}

function isFormaPagoId(value) {
  return normalizeUpperText(value) === "FORMAPAGO";
}

function isCuotaPaymentMeans(value) {
  return /^CUOTA\d+$/i.test(normalizeUpperText(value) ?? "");
}

function isGuiaDocumentType(documentTypeCode, documentTypeLabel) {
  const normalizedCode = normalizeUpperText(documentTypeCode);
  const normalizedLabel = normalizeUpperText(documentTypeLabel);

  return normalizedCode === "09" || normalizedCode === "31" || normalizedLabel?.includes("GUIA");
}

function extractDetraccion(root, total = 0) {
  const paymentMeansList = toArray(root?.PaymentMeans);
  const paymentTermsList = toArray(root?.PaymentTerms);

  let detraccionAplica = false;
  let detraccionMedioPagoCodigo = null;
  let detraccionCodigoBienServicio = null;
  let detraccionPorcentaje = 0;
  let detraccionMonto = 0;
  let detraccionCuentaBanco = null;

  for (const paymentMeans of paymentMeansList) {
    if (normalizeUpperText(paymentMeans?.ID) !== "DETRACCION") continue;

    detraccionAplica = true;

    if (!detraccionMedioPagoCodigo) {
      detraccionMedioPagoCodigo = normalizeUpperText(paymentMeans?.PaymentMeansCode);
    }

    if (!detraccionCuentaBanco) {
      detraccionCuentaBanco = safeStr(paymentMeans?.PayeeFinancialAccount?.ID) ?? null;
    }
  }

  for (const paymentTerms of paymentTermsList) {
    if (normalizeUpperText(paymentTerms?.ID) !== "DETRACCION") continue;

    detraccionAplica = true;

    if (!detraccionCodigoBienServicio) {
      detraccionCodigoBienServicio = normalizeUpperText(paymentTerms?.PaymentMeansID);
    }

    const percent = safeDecimal(paymentTerms?.PaymentPercent);
    const amount = safeDecimal(paymentTerms?.Amount);

    if (percent != null) detraccionPorcentaje = percent;
    if (amount != null) detraccionMonto = amount;
  }

  const extContent = root?.UBLExtensions?.UBLExtension?.ExtensionContent ?? {};
  const sunatTx = extContent?.SUNATTransaction ?? extContent?.SUNATEmbededDespatchAdvice ?? {};
  if (sunatTx) {
    const percent = safeDecimal(sunatTx.SUNATPaymentTerms?.PaymentPercent);
    const amount = safeDecimal(sunatTx.SUNATPaymentTerms?.Amount);

    if (percent != null && detraccionPorcentaje === 0) {
      detraccionPorcentaje = percent;
      detraccionAplica = true;
    }

    if (amount != null && detraccionMonto === 0) {
      detraccionMonto = amount;
      detraccionAplica = true;
    }
  }

  if (detraccionPorcentaje === 0 && detraccionMonto > 0 && total > 0) {
    detraccionPorcentaje = parseFloat(((detraccionMonto / total) * 100).toFixed(2));
  }

  if (detraccionMonto === 0 && detraccionPorcentaje > 0 && total > 0) {
    detraccionMonto = parseFloat(((detraccionPorcentaje / 100) * total).toFixed(2));
  }

  if (
    detraccionMedioPagoCodigo ||
    detraccionCodigoBienServicio ||
    detraccionCuentaBanco ||
    detraccionPorcentaje > 0 ||
    detraccionMonto > 0
  ) {
    detraccionAplica = true;
  }

  return {
    detraccionAplica,
    detraccionMedioPagoCodigo,
    detraccionCodigoBienServicio,
    detraccionPorcentaje,
    detraccionMonto,
    detraccionCuentaBanco,
  };
}

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
    throw new Error(`XML invalido: ${err.message}`);
  }

  const root =
    doc?.Invoice ??
    doc?.["ext:Invoice"] ??
    Object.values(doc || {}).find((value) => value && typeof value === "object") ??
    doc;

  if (!root || typeof root !== "object") {
    throw new Error("XML sin estructura valida de Invoice (SUNAT UBL).");
  }

  const idCompleto = safeStr(root.ID);
  if (!idCompleto) {
    throw new Error("El XML no contiene el numero de comprobante (cbc:ID). Verifica el archivo.");
  }

  const { serie, numero } = parseSerieNumero(idCompleto);
  if (!serie || !numero) {
    throw new Error(
      `No se pudo extraer serie y numero del ID "${idCompleto}". Formato esperado: F001-12345.`,
    );
  }

  const tipoCode = safeStr(root.InvoiceTypeCode) ?? "01";
  const tipos = {
    "01": "FACTURA",
    "03": "BOLETA",
    "07": "NOTA_CREDITO",
    "08": "NOTA_DEBITO",
  };
  const tipo = tipos[tipoCode] ?? `COMPROBANTE_${tipoCode}`;

  const fechaEmision = safeDate(root.IssueDate);
  if (!fechaEmision) {
    throw new Error("El XML no contiene la fecha de emision (cbc:IssueDate).");
  }

  const fechaVencimientoRaiz = safeDate(root.DueDate) ?? safeDate(root.PaymentDueDate) ?? null;
  const moneda = safeStr(root.DocumentCurrencyCode) ?? "PEN";

  const customerNode = root.AccountingCustomerParty;
  if (!customerNode) {
    throw new Error(
      "El XML no contiene el cliente receptor (cac:AccountingCustomerParty). No se puede identificar al cliente.",
    );
  }

  const clienteRuc = partyId(customerNode);
  const clienteNombre = partyName(customerNode);

  if (!clienteRuc && !clienteNombre) {
    throw new Error("No se pudo extraer el RUC ni la razon social del cliente receptor.");
  }

  if (!clienteRuc) {
    warnings.push("No se encontro el RUC del cliente receptor. Se usara la razon social para busqueda.");
  }
  if (!clienteNombre) {
    warnings.push("No se encontro la razon social del cliente receptor.");
  }

  const supplierNode = root.AccountingSupplierParty;
  const emisorRuc = partyId(supplierNode) ?? null;
  const emisorNombre = partyName(supplierNode) ?? null;

  const monetaryTotal = root.LegalMonetaryTotal ?? root.RequestedMonetaryTotal ?? {};
  const montoNeto = safeDecimal(monetaryTotal.LineExtensionAmount) ?? safeDecimal(monetaryTotal.TaxExclusiveAmount) ?? 0;
  const total = safeDecimal(monetaryTotal.PayableAmount) ?? safeDecimal(monetaryTotal.TaxInclusiveAmount) ?? null;

  if (total == null) {
    throw new Error("El XML no contiene el importe total (cac:LegalMonetaryTotal/cbc:PayableAmount).");
  }

  let igv = 0;
  const taxTotals = toArray(root.TaxTotal);
  for (const taxTotal of taxTotals) {
    const subtotals = toArray(taxTotal.TaxSubtotal);
    for (const subtotal of subtotals) {
      const taxCode = safeStr(subtotal?.TaxCategory?.TaxScheme?.ID);
      if (!taxCode || taxCode === "1000" || taxCode === "IGV") {
        const amount = safeDecimal(subtotal.TaxAmount);
        if (amount != null) {
          igv = amount;
          break;
        }
      }
    }

    if (igv > 0) break;

    const firstTaxAmount = safeDecimal(taxTotal.TaxAmount);
    if (firstTaxAmount != null && igv === 0) igv = firstTaxAmount;
  }

  const {
    detraccionAplica,
    detraccionMedioPagoCodigo,
    detraccionCodigoBienServicio,
    detraccionPorcentaje,
    detraccionMonto,
    detraccionCuentaBanco,
  } = extractDetraccion(root, total);

  const paymentTermsList = toArray(root.PaymentTerms);
  let formaPago = null;
  let formaPagoFallback = null;
  const cuotaDueDates = [];

  for (const paymentTerms of paymentTermsList) {
    const termId = safeStr(paymentTerms.ID);
    const paymentMeansId = normalizeUpperText(paymentTerms.PaymentMeansID);
    const paymentDueDate = safeDate(paymentTerms.PaymentDueDate);

    if (paymentDueDate && isCuotaPaymentMeans(paymentMeansId)) {
      cuotaDueDates.push(paymentDueDate);
    }

    if (!isFormaPagoId(termId)) continue;

    if (paymentMeansId === "CREDITO" || paymentMeansId === "CONTADO") {
      formaPago = paymentMeansId;
      continue;
    }

    if (paymentMeansId && !isCuotaPaymentMeans(paymentMeansId) && !formaPagoFallback) {
      formaPagoFallback = paymentMeansId;
    }
  }

  if (!formaPago && formaPagoFallback) {
    formaPago = formaPagoFallback;
  }

  if (!formaPago && cuotaDueDates.length > 0) {
    formaPago = "CREDITO";
  }

  let fechaVencimiento = fechaVencimientoRaiz;
  if (cuotaDueDates.length > 0) {
    const primeraCuota = [...cuotaDueDates].sort()[0];
    if (formaPago === "CREDITO" || !fechaVencimiento) {
      fechaVencimiento = primeraCuota;
    }
  }

  if (formaPago === "CONTADO" && !fechaVencimientoRaiz && cuotaDueDates.length === 0) {
    fechaVencimiento = null;
  }

  const despatchRefs = toArray(root.DespatchDocumentReference);
  const additionalRefs = toArray(root.AdditionalDocumentReference);
  const guiasRelacionadas = [];
  const seenGuias = new Set();
  const facturaKey = `${serie}-${numero}`;

  function addGuia(value) {
    const guia = parseGuiaRef(value);
    if (!guia) return;

    const key = `${guia.serieGuia}-${guia.numeroGuia}`;
    if (key === facturaKey) return;
    if (seenGuias.has(key)) return;

    seenGuias.add(key);
    guiasRelacionadas.push(guia);
  }

  for (const ref of despatchRefs) {
    addGuia(safeStr(ref.ID));
  }

  for (const ref of additionalRefs) {
    if (isGuiaDocumentType(ref.DocumentTypeCode, ref.DocumentType)) {
      addGuia(safeStr(ref.ID));
    }
  }

  const notes = toArray(root.Note);
  for (const note of notes) {
    const text = safeStr(note) ?? "";
    const regex = /\b([A-Z][A-Z0-9]{1,3})\s*[\u2010-\u2015-]\s*(\d{1,12})\b/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      addGuia(`${match[1]}-${match[2]}`);
    }
  }

  if (guiasRelacionadas.length === 0) {
    warnings.push("No se encontraron guias de remision relacionadas en el XML.");
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
    detraccionAplica,
    detraccionMedioPagoCodigo,
    detraccionCodigoBienServicio,
    detraccionPorcentaje,
    detraccionMonto,
    detraccionCuentaBanco,
    formaPago,
    guiasRelacionadas,
    warnings,
  };
}

module.exports = { parseXmlFactura, parseSerieNumero };
