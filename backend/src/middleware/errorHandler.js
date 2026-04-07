/**
 * errorHandler.js — Manejador centralizado de errores para Express.
 *
 * Captura todos los errores no manejados que se propaguen con next(err).
 * - En desarrollo: incluye stack trace en la respuesta para debug
 * - En producción: mensaje genérico, detalle solo en logs
 *
 * Debe registrarse como ÚLTIMO middleware en index.js:
 *   app.use(errorHandler);
 */

const logger = require("../lib/logger");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== "production";

  // Determinar código de estado
  const status = err.status || err.statusCode || 500;

  // Loguear siempre con contexto de la request
  logger.error("Error no manejado", {
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id || null,
    },
    status,
  });

  // Nunca exponer internals en producción
  const message =
    status < 500
      ? err.message // errores del cliente (4xx) son seguros para mostrar
      : isDev
      ? err.message
      : "Error interno del servidor";

  const body = { error: message };

  // En desarrollo, incluir stack para depuración
  if (isDev && status >= 500) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = errorHandler;
