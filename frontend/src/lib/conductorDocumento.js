export const TIPOS_DOCUMENTO_CONDUCTOR = [
  "DNI",
  "CE",
  "DOCUMENTO DE IDENTIDAD EXTRANJERO",
];

const DOCUMENTO_CONFIG = {
  DNI: {
    maxLength: 8,
    placeholder: "Ej: 12345678",
    hint: "DNI: 8 digitos",
    regex: /^\d{8}$/,
    error: "El DNI debe tener exactamente 8 digitos numericos.",
  },
  CE: {
    maxLength: 9,
    placeholder: "Ej: 123456789",
    hint: "CE: 9 digitos",
    regex: /^\d{9}$/,
    error: "El CE debe tener exactamente 9 digitos numericos.",
  },
  "DOCUMENTO DE IDENTIDAD EXTRANJERO": {
    maxLength: 20,
    placeholder: "Ej: 123456789012",
    hint: "Documento de identidad extranjero: hasta 20 digitos",
    regex: /^\d{1,20}$/,
    error: "El documento de identidad extranjero debe contener solo digitos y tener maximo 20.",
  },
};

export function isTipoDocumentoConductorValido(tipoDocumento) {
  return TIPOS_DOCUMENTO_CONDUCTOR.includes(tipoDocumento);
}

export function getDocumentoConductorConfig(tipoDocumento) {
  return DOCUMENTO_CONFIG[tipoDocumento] ?? DOCUMENTO_CONFIG.DNI;
}

export function sanitizeDocumentoConductor(value, tipoDocumento) {
  const { maxLength } = getDocumentoConductorConfig(tipoDocumento);
  return String(value ?? "").replace(/\D/g, "").slice(0, maxLength);
}

export function validateDocumentoConductor(tipoDocumento, nroDocumento) {
  if (!isTipoDocumentoConductorValido(tipoDocumento)) return false;
  const value = String(nroDocumento ?? "").trim();
  return getDocumentoConductorConfig(tipoDocumento).regex.test(value);
}

export function getDocumentoConductorError(tipoDocumento, nroDocumento) {
  if (!isTipoDocumentoConductorValido(tipoDocumento)) {
    return "Selecciona un tipo de documento valido para conductor.";
  }
  return validateDocumentoConductor(tipoDocumento, nroDocumento)
    ? ""
    : getDocumentoConductorConfig(tipoDocumento).error;
}
