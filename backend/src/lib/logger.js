/**
 * logger.js — Logger estructurado basado en Pino.
 *
 * - En desarrollo: salida legible con pino-pretty
 * - En producción: JSON compacto (listo para ingestión por log aggregators)
 * - Redacta automáticamente campos sensibles
 * - Niveles: trace | debug | info | warn | error | fatal
 *
 * Uso:
 *   const logger = require('../lib/logger');
 *   logger.info('Servicio creado', { servicioId, usuarioId });
 *   logger.warn('Intento de login fallido', { email });
 *   logger.error('Error inesperado', { err });
 */

const pino = require("pino");

const isDev = process.env.NODE_ENV !== "production";

const transport = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    }
  : undefined;

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport,
  // Nunca loguear estos campos aunque aparezcan en los objetos pasados
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "*.password",
      "*.passwordHash",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  base: {
    env: process.env.NODE_ENV || "development",
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

module.exports = logger;
