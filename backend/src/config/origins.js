const DEFAULT_DEV_ORIGINS = ["http://localhost:5173"];

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return null;

  try {
    return new URL(value).origin;
  } catch (_err) {
    return null;
  }
}

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS;
  const values = raw
    ? raw
        .split(",")
        .map((origin) => normalizeOrigin(origin.trim()))
        .filter(Boolean)
    : DEFAULT_DEV_ORIGINS;

  return Array.from(new Set(values));
}

function getRequestOrigin(req) {
  const originHeader = normalizeOrigin(req.headers.origin);
  if (originHeader) return originHeader;

  return normalizeOrigin(req.headers.referer);
}

module.exports = {
  getAllowedOrigins,
  getRequestOrigin,
  normalizeOrigin,
};
