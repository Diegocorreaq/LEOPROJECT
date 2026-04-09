/**
 * Normaliza placas para comparaciones tolerantes entre XML, base de datos y UI.
 */
function normalizePlaca(value) {
  return String(value ?? "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "");
}

function placasCoinciden(left, right) {
  const leftNormalized = normalizePlaca(left);
  const rightNormalized = normalizePlaca(right);

  return leftNormalized !== "" && leftNormalized === rightNormalized;
}

module.exports = { normalizePlaca, placasCoinciden };
