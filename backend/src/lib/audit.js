const prisma = require("./prisma");
const logger = require("./logger");

async function recordAuditEvent(event, db = prisma) {
  const {
    entityType,
    entityId,
    action,
    req,
    metadata = null,
    actorId = req?.user?.id ?? null,
    actorRole = req?.user?.rol ?? null,
  } = event;

  if (!entityType || !entityId || !action) return;

  try {
    await db.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        actorId,
        actorRole,
        requestId: req?.requestId ?? null,
        method: req?.method ?? null,
        path: req?.originalUrl ?? null,
        metadata,
      },
    });
  } catch (err) {
    const currentLogger = req?.log || logger;
    currentLogger.warn("No se pudo registrar auditoria persistente", {
      entityType,
      entityId,
      action,
      error: err.message,
    });
  }
}

module.exports = {
  recordAuditEvent,
};
