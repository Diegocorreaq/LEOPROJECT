/**
 * Safe date-only formatting utilities.
 *
 * Problem: new Date("YYYY-MM-DD") parses as UTC midnight. In Peru (UTC-5),
 * toLocaleDateString() then shows the previous calendar day.
 *
 * Fix: slice the ISO string to "YYYY-MM-DD", split and construct
 * new Date(y, m-1, d) using the local-time constructor — no UTC conversion.
 * Works equally for dates stored as T00:00:00.000Z or T12:00:00.000Z.
 */

function parseDateOnly(iso) {
  if (!iso) return null;
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatDateOnly(iso, opts = { day: "2-digit", month: "short", year: "numeric" }) {
  const date = parseDateOnly(iso);
  if (!date) return "-";
  return date.toLocaleDateString("es-PE", opts);
}

export function formatDateShort(iso) {
  return formatDateOnly(iso, { day: "2-digit", month: "short", year: "2-digit" });
}

export function formatDateLong(iso) {
  return formatDateOnly(iso, { day: "2-digit", month: "short", year: "numeric" });
}

export function toDateInputValue(iso) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function todayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
