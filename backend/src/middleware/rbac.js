const ROLES_VALIDOS = ["OPERACIONES", "ADMIN"];

function requireRole(...roles) {
  roles.forEach((rol) => {
    if (!ROLES_VALIDOS.includes(rol)) {
      throw new Error(`[RBAC] Rol desconocido en requireRole: "${rol}"`);
    }
  });

  return function rbacMiddleware(req, res, next) {
    if (!req.user) {
      req.log.error("requireRole ejecutado sin req.user");
      return res.status(500).json({ error: "Error de configuracion del servidor" });
    }

    if (!roles.includes(req.user.rol)) {
      req.log.warn("Acceso denegado por rol insuficiente", {
        userId: req.user.id,
        rolActual: req.user.rol,
        rolesRequeridos: roles,
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        error: "No tienes permisos para realizar esta accion",
      });
    }

    next();
  };
}

const requireAdmin = requireRole("ADMIN");
const requireOperaciones = requireRole("OPERACIONES", "ADMIN");

module.exports = { requireRole, requireAdmin, requireOperaciones };
