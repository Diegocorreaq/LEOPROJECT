const { randomUUID } = require("crypto");
const logger = require("../lib/logger");

module.exports = function requestContext(req, res, next) {
  const incomingId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"].trim() : "";

  req.requestId = incomingId && incomingId.length <= 120 ? incomingId : randomUUID();
  req.log = logger.child({
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });

  res.setHeader("X-Request-Id", req.requestId);
  next();
};
