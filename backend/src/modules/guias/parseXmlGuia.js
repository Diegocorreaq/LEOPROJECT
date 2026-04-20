/**
 * parseXmlGuia.js — Parser XML para Guías de Remisión SUNAT (UBL DespatchAdvice).
 *
 * Tolerante a nodos faltantes: no lanza error si faltan DespatchLine,
 * AdditionalDocumentReference, Note, placa secundaria, subcontratista, etc.
 *
 * Mapeo de nodos según los XML reales de SUNAT Perú.
 */

const { XMLParser } = require("fast-xml-parser");

// ── Helpers ───────────────────────────────────────────────────────────────────

function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Extrae texto real desde un nodo XML que puede venir como:
 *   - string/number/bool
 *   - objeto con atributos y '#text'
 *   - array de nodos
 */
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

function safeStr(val) {
  return nodeText(val);
}

function safeDate(val) {
  const raw = nodeText(val);
  if (raw == null) return null;
  try {
    // Fechas solo-día (YYYY-MM-DD) del XML SUNAT se tratan como fecha calendario.
    // Se anclan al mediodía UTC para evitar rollback por UTC-5 (Perú) en cualquier zona.
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())
      ? `${raw.trim()}T12:00:00.000Z`
      : raw;
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function nodeAttr(node, attr) {
  if (node == null || typeof node !== "object") return null;
  return safeStr(node[`@_${attr}`]);
}

function partyNode(node) {
  return node?.Party ?? node ?? null;
}

function partyIdText(node) {
  return nodeText(partyNode(node)?.PartyIdentification?.ID);
}

function partyRegistrationName(node) {
  return safeStr(partyNode(node)?.PartyLegalEntity?.RegistrationName);
}

function distinctJoin(parts) {
  const unique = [];
  const seen = new Set();

  for (const part of parts) {
    const text = safeStr(part);
    if (!text) continue;

    const key = text.replace(/\s+/g, " ").trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
  }

  return unique.length > 0 ? unique.join(" ") : null;
}

// ── Parser principal ──────────────────────────────────────────────────────────

function parseXmlGuia(xmlBuffer) {
  const warnings = [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    isArray: (name) =>
      [
        "DespatchLine",
        "AdditionalDocumentReference",
        "SpecialInstructions",
        "Note",
        "TransportEquipment",
        "AttachedTransportEquipment",
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

  // Root puede ser DespatchAdvice u otro nombre
  const root =
    doc?.DespatchAdvice ??
    doc?.["ext:DespatchAdvice"] ??
    Object.values(doc || {}).find((v) => v && typeof v === "object") ??
    doc;

  if (!root || typeof root !== "object") {
    throw new Error("XML sin estructura válida de DespatchAdvice.");
  }

  // ── ID completo (ej: "EG03-10453") ─────────────────────────────────────────
  const idCompleto = nodeText(root.ID);

  // ── Fechas ──────────────────────────────────────────────────────────────────
  const fechaEmision = safeDate(root.IssueDate);
  const horaEmision = nodeText(root.IssueTime);

  if (!fechaEmision) warnings.push("No se encontró IssueDate en el XML.");

  // ── Observación SUNAT (cbc:Note) ────────────────────────────────────────────
  const notes = toArray(root.Note);
  const observacionSunat =
    notes.length > 0
      ? nodeText(notes[0])
      : null;

  // ── SpecialInstructions — indicadores booleanos ─────────────────────────────
  let transbordo = false;
  let retornoVacio = false;
  let subcontratado = false;

  for (const si of toArray(root.SpecialInstructions)) {
    const code = nodeText(si);
    if (!code) continue;
    const upper = code.toUpperCase();
    if (upper.includes("TRANSBORDO")) transbordo = true;
    else if (upper.includes("RETORNO")) retornoVacio = true;
    else if (upper.includes("SUBCONTRAT")) subcontratado = true;
    // Códigos desconocidos no bloquean la importación
  }

  // ── Transportista (DespatchSupplierParty) ────────────────────────────────────
  const despatchSupplier = root?.DespatchSupplierParty;
  const transportistaRuc = partyIdText(despatchSupplier);
  const transportistaNombre = partyRegistrationName(despatchSupplier);

  // ── Destinatario (DeliveryCustomerParty) ────────────────────────────────────
  const deliveryCustomer = root?.DeliveryCustomerParty;
  const destinatarioRuc = partyIdText(deliveryCustomer);
  const destinatarioNombre = partyRegistrationName(deliveryCustomer);

  // ── Pagador del flete (OriginatorCustomerParty) ─────────────────────────────
  const originatorCustomer = root?.OriginatorCustomerParty;
  const pagadorFleteRuc = partyIdText(originatorCustomer);
  const pagadorFleteNombre = partyRegistrationName(originatorCustomer);

  if (!pagadorFleteRuc && !pagadorFleteNombre) {
    warnings.push(
      "Pagador del flete (OriginatorCustomerParty) no encontrado en el XML."
    );
  }

  // ── Shipment ─────────────────────────────────────────────────────────────────
  const shipment = root?.Shipment;

  // Peso bruto
  const gwNode = shipment?.GrossWeightMeasure;
  let pesoBrutoTotal = null;
  let unidadPeso = null;
  if (gwNode != null) {
    const gwText = nodeText(gwNode) ?? safeStr(gwNode);
    pesoBrutoTotal = gwText ? parseFloat(gwText) : null;
    if (isNaN(pesoBrutoTotal)) pesoBrutoTotal = null;
    unidadPeso = nodeAttr(gwNode, "unitCode");
  }

  // ShipmentStage
  const shipmentStage = shipment?.ShipmentStage;

  // Fecha inicio traslado
  const fechaInicioTraslado = safeDate(
    shipmentStage?.TransitPeriod?.StartDate
  );

  // Conductor principal
  const driverPerson = shipmentStage?.DriverPerson;
  const conductorPrincipalDocumento = nodeText(driverPerson?.ID);
  const firstName = nodeText(driverPerson?.FirstName);
  const familyName = nodeText(driverPerson?.FamilyName);
  const conductorPrincipalNombre = distinctJoin([firstName, familyName]);
  const conductorPrincipalLicencia = nodeText(
    driverPerson?.IdentityDocumentReference?.ID
  );

  const carrierParty = partyNode(shipmentStage?.CarrierParty);
  const mtcNumero = nodeText(carrierParty?.PartyLegalEntity?.CompanyID);

  // Delivery → DespatchAddress (punto de salida) y DeliveryAddress (punto de llegada)
  const delivery = shipment?.Delivery;
  const despatch = delivery?.Despatch;

  const puntoDeSalida = nodeText(
    despatch?.DespatchAddress?.AddressLine?.Line
  );
  const puntoDeLlegada = nodeText(
    delivery?.DeliveryAddress?.AddressLine?.Line
  );

  // Remitente real (DespatchParty dentro de Shipment/Delivery/Despatch)
  const despatchParty = despatch?.DespatchParty;
  const remitenteRuc = partyIdText(despatchParty);
  const remitenteNombre = partyRegistrationName(despatchParty);

  // Placa principal y secundaria (TransportHandlingUnit/TransportEquipment)
  let placaPrincipal = null;
  let placaSecundaria = null;

  const thu = shipment?.TransportHandlingUnit;
  if (thu) {
    const teList = toArray(thu.TransportEquipment);
    const te = teList[0];
    if (te) {
      placaPrincipal = nodeText(te.ID);
      const attached = toArray(te.AttachedTransportEquipment);
      const att = attached[0];
      if (att) placaSecundaria = nodeText(att.ID);
    }
  }

  // Subcontratista (Shipment/Consignment/LogisticsOperatorParty)
  const logisticsOp = shipment?.Consignment?.LogisticsOperatorParty;
  const subcontratistaRuc = partyIdText(logisticsOp);
  const subcontratistaNombre = partyRegistrationName(logisticsOp);

  if (subcontratistaRuc || subcontratistaNombre) subcontratado = true;

  // ── Documentos relacionados ──────────────────────────────────────────────────
  const addDocRefs = toArray(root.AdditionalDocumentReference);
  const docsRelacionados = addDocRefs
    .map((ref) => ({
      tipoDocumentoCode: nodeText(ref?.DocumentTypeCode),
      tipoDocumento:
        nodeText(ref?.DocumentType) ??
        nodeText(ref?.DocumentTypeCode) ??
        "DOCUMENTO",
      numeroDocumento: nodeText(ref?.ID) ?? "",
      rucEmisor: partyIdText(ref?.IssuerParty),
    }))
    .filter((d) => d.numeroDocumento);

  // ── Bienes (DespatchLine) ────────────────────────────────────────────────────
  const despatchLines = toArray(root.DespatchLine);
  const bienes = despatchLines.map((line) => {
    const dqNode = line?.DeliveredQuantity;
    let cantidad = null;
    let unidadMedida = null;

    if (dqNode != null) {
      const dqText = nodeText(dqNode) ?? safeStr(dqNode);
      cantidad = dqText ? parseFloat(dqText) : null;
      if (isNaN(cantidad)) cantidad = null;
      unidadMedida = nodeAttr(dqNode, "unitCode");
    }

    return {
      descripcion: safeStr(line?.Item?.Description) ?? "Sin descripción",
      cantidad,
      unidadMedida,
    };
  });

  if (bienes.length === 0) {
    warnings.push("No se encontraron bienes en DespatchLine (puede ser normal en guías de subcontratación).");
  }

  return {
    idCompleto,
    fechaEmision,
    horaEmision,
    fechaInicioTraslado,
    transportistaRuc,
    transportistaNombre,
    remitenteRuc,
    remitenteNombre,
    destinatarioRuc,
    destinatarioNombre,
    pagadorFleteRuc,
    pagadorFleteNombre,
    puntoDeSalida,
    puntoDeLlegada,
    pesoBrutoTotal,
    unidadPeso,
    mtcNumero,
    placaPrincipal,
    placaSecundaria,
    conductorPrincipalDocumento,
    conductorPrincipalNombre,
    conductorPrincipalLicencia,
    subcontratistaRuc,
    subcontratistaNombre,
    transbordo,
    retornoVacio,
    subcontratado,
    observacionSunat,
    docsRelacionados,
    bienes,
    warnings,
  };
}

module.exports = { parseXmlGuia };
