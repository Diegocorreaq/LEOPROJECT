const DEFAULT_DEV_ORIGINS = ["http://localhost:5173"];

function normalizeOrigin(value) {
  if (!value || typeof value !== "string") return null;

  try {
    return new URL(value).origin;
  } catch (_err) {
    return null;
  }
}

function getHeaderFirstValue(value) {
  if (!value) return null;

  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === "string" ? rawValue.split(",")[0].trim() : null;
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

function getServerOrigin(req) {
  if (!req) return null;

  const protocol = getHeaderFirstValue(req.headers["x-forwarded-proto"]) || req.protocol;
  const host = getHeaderFirstValue(req.headers["x-forwarded-host"]) || req.headers.host;

  if (!protocol || !host) return null;

  return normalizeOrigin(`${protocol}://${host}`);
}

function getRequestOrigin(req) {
  const originHeader = normalizeOrigin(req.headers.origin);
  if (originHeader) return originHeader;

  return normalizeOrigin(req.headers.referer);
}

function isAllowedOrigin(origin, req, allowedOrigins = getAllowedOrigins()) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  const serverOrigin = getServerOrigin(req);
  return Boolean(serverOrigin && normalizedOrigin === serverOrigin);
}

module.exports = {
  getAllowedOrigins,
  getRequestOrigin,
  getServerOrigin,
  isAllowedOrigin,
  normalizeOrigin,
};
