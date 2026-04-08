const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

module.exports = async function authMiddleware(req, res, next) {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.slice(7);
    }

    if (!token) {
      return res.status(401).json({ error: "No autenticado. Inicia sesion para continuar." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Sesion expirada. Inicia sesion nuevamente." });
      }
      return res.status(401).json({ error: "Token invalido." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });

    if (!usuario) {
      req.log.warn("Token JWT valido pero usuario no existe en BD", { userId: decoded.id });
      return res.status(401).json({ error: "Usuario no encontrado." });
    }

    if (!usuario.activo) {
      req.log.warn("Intento de acceso con usuario desactivado", {
        userId: usuario.id,
        email: usuario.email,
      });
      return res.status(401).json({
        error: "Tu cuenta esta desactivada. Contacta al administrador.",
      });
    }

    req.user = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };

    next();
  } catch (err) {
    req.log.error("Error inesperado en auth middleware", { err: err.message });
    return res.status(500).json({ error: "Error de autenticacion" });
  }
};
