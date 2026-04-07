/**
 * rbac.js — Role-Based Access Control (RBAC) para Grupo Leo.
 *
 * Roles actuales del sistema (campo `rol` en modelo Usuario):
 *   OPERACIONES — usuario estándar de operaciones (rol por defecto)
 *   ADMIN       — administrador del sistema (permisos completos)
 *
 * Uso en rutas:
 *   const { requireRole } = require('../middleware/rbac');
 *
 *   router.delete('/:id', requireRole('ADMIN'), async (req, res) => { ... });
 *   router.get('/', requireRole('OPERACIONES', 'ADMIN'), async (req, res) => { ... });
 *
 * SUPUESTO: Todos los usuarios existentes tienen rol 'OPERACIONES'.
 * Agregar rol 'ADMIN' directamente en BD cuando se necesite.
 */

const logger = require("../lib/logger");

const ROLES_VALIDOS = ["OPERACIONES", "ADMIN"];

/**
 * requireRole(...roles) — middleware factory.
 * Verifica que req.user (puesto por authMiddleware) tenga uno de los roles indicados.
 * Siempre debe usarse DESPUÉS de authMiddleware.
 */
function requireRole(...roles) {
  // Validar en startup que no se pase un rol desconocido
  roles.forEach((r) => {
    if (!ROLES_VALIDOS.includes(r)) {
      throw new Error(`[RBAC] Rol desconocido en requireRole: "${r}"`);
    }
  });

  return function rbacMiddleware(req, res, next) {
    if (!req.user) {
      // authMiddleware no corrió primero — error de programación
      logger.error("requireRole ejecutado sin req.user — ¿authMiddleware no está activo?");
      return res.status(500).json({ error: "Error de configuración del servidor" });
    }

    if (!roles.includes(req.user.rol)) {
      logger.warn("Acceso denegado por rol insuficiente", {
        userId: req.user.id,
        rolActual: req.user.rol,
        rolesRequeridos: roles,
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        error: "No tienes permisos para realizar esta acción",
      });
    }

    next();
  };
}

/**
 * requireAdmin — shortcut para rutas solo-admin
 */
const requireAdmin = requireRole("ADMIN");

/**
 * requireOperaciones — shortcut para rutas de operaciones o admin
 */
const requireOperaciones = requireRole("OPERACIONES", "ADMIN");

module.exports = { requireRole, requireAdmin, requireOperaciones };
