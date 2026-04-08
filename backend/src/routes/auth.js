const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const { validate } = require("../lib/validate");
const { loginSchema } = require("../validators/auth.schema");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos de inicio de sesion. Intenta nuevamente en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === "true",
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const body = validate(loginSchema, req.body, res);
    if (!body) return;

    const { email, password } = body;
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    const hashFicticio = "$2b$10$invalido.hash.para.evitar.timing.attack.aqui00000";
    const hashReal = usuario?.passwordHash || hashFicticio;
    const valid = await bcrypt.compare(password, hashReal);

    if (!usuario || !usuario.activo || !valid) {
      req.log.warn("Login fallido", {
        email,
        motivo: !usuario ? "usuario no encontrado" : !usuario.activo ? "inactivo" : "contrasena incorrecta",
        ip: req.ip,
      });
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });
    setAuthCookie(res, token);

    req.log.info("Login exitoso", { userId: usuario.id, email, rol: usuario.rol, ip: req.ip });
    res.json({ usuario: payload });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", { path: "/", httpOnly: true });
  req.log.info("Logout ejecutado", { userId: req.user?.id ?? null });
  res.json({ message: "Sesion cerrada correctamente" });
});

router.get("/me", authMiddleware, (req, res) => {
  res.json({ usuario: req.user });
});

module.exports = router;
