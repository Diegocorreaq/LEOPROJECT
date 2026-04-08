const { getAllowedOrigins, getRequestOrigin } = require("../config/origins");
const logger = require("../lib/logger");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

module.exports = function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const usesSessionCookie = Boolean(req.cookies?.token);
  const usesBearerAuth = req.headers.authorization?.startsWith("Bearer ");

  if (!usesSessionCookie || usesBearerAuth) {
    return next();
  }

  const requestOrigin = getRequestOrigin(req);
  const allowedOrigins = getAllowedOrigins();

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return next();
  }

  const currentLogger = req.log || logger;
  currentLogger.warn("Solicitud bloqueada por validacion CSRF", {
    origin: requestOrigin,
    allowedOrigins,
  });

  return res.status(403).json({
    error: "Solicitud bloqueada por validacion CSRF.",
    requestId: req.requestId,
  });
};
