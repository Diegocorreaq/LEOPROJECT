/**
 * auth.js — Middleware de autenticación JWT con cookie HttpOnly.
 *
 * Flujo:
 *   1. Lee el token desde la cookie HttpOnly `token` (primario).
 *   2. Fallback: lee desde Authorization: Bearer <token> (retrocompat. / clientes API).
 *   3. Verifica la firma JWT con JWT_SECRET.
 *   4. Consulta la BD para asegurarse de que el usuario sigue activo.
 *      → Si un admin desactiva al usuario, el próximo request falla aunque el token sea válido.
 *   5. Adjunta req.user con los datos actuales de la BD.
 *
 * NOTA DE PERFORMANCE: El step 4 agrega ~1-5ms por request (round-trip a BD).
 * En sistemas de alta carga, considerar cachear con Redis (TTL: 60s).
 */

const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const logger = require("../lib/logger");

module.exports = async function authMiddleware(req, res, next) {
  try {
    // 1. Intentar cookie HttpOnly (mecanismo primario)
    let token = req.cookies?.token;

    // 2. Fallback: Authorization header (para clientes API / período de migración)
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7);
    }

    if (!token) {
      return res.status(401).json({ error: "No autenticado. Inicia sesión para continuar." });
    }

    // 3. Verificar firma JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Sesión expirada. Inicia sesión nuevamente." });
      }
      return res.status(401).json({ error: "Token inválido." });
    }

    // 4. Verificar en BD que el usuario sigue activo
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });

    if (!usuario) {
      logger.warn("Token JWT válido pero usuario no existe en BD", { userId: decoded.id });
      return res.status(401).json({ error: "Usuario no encontrado." });
    }

    if (!usuario.activo) {
      logger.warn("Intento de acceso con usuario desactivado", {
        userId: usuario.id,
        email: usuario.email,
      });
      return res.status(401).json({
        error: "Tu cuenta está desactivada. Contacta al administrador.",
      });
    }

    // 5. Adjuntar usuario actual desde BD (no del payload JWT desactualizado)
    req.user = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };

    next();
  } catch (err) {
    logger.error("Error inesperado en auth middleware", { err: err.message });
    return res.status(500).json({ error: "Error de autenticación" });
  }
};
