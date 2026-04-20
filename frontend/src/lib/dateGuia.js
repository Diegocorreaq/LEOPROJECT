import { formatDateOnly, formatDateShort, toDateInputValue } from "./dateOnly";

export function fmtGuiaDate(iso, opts = { day: "2-digit", month: "short", year: "numeric" }) {
  return formatDateOnly(iso, opts);
}

export function fmtGuiaDateCorta(iso) {
  return formatDateShort(iso);
}

export function isoToDateInput(iso) {
  return toDateInputValue(iso);
}
