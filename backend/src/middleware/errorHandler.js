const logger = require("../lib/logger");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== "production";
  const status = err.status || err.statusCode || 500;
  const currentLogger = req.log || logger;

  currentLogger.error("Error no manejado", {
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id || null,
      requestId: req.requestId || null,
    },
    status,
  });

  const message =
    status < 500
      ? err.message
      : isDev
        ? err.message
        : "Error interno del servidor";

  const body = {
    error: message,
    requestId: req.requestId,
  };

  if (isDev && status >= 500) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = errorHandler;
