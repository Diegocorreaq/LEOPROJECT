/**
 * auth.js — Rutas de autenticación
 *
 * POST /api/auth/login   → autentica, emite cookie HttpOnly
 * POST /api/auth/logout  → borra la cookie
 * GET  /api/auth/me      → devuelve usuario actual (requiere cookie válida)
 */

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const authMiddleware = require("../middleware/auth");
const logger = require("../lib/logger");
const { validate } = require("../lib/validate");
const { loginSchema } = require("../validators/auth.schema");

const router = express.Router();

// ── Rate limit específico para login: 10 intentos / 15 min por IP ──────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos de inicio de sesión. Intenta nuevamente en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // los logins exitosos no cuentan contra el límite
  // keyGenerator usa el default de express-rate-limit (maneja IPv4/IPv6 correctamente)
});

// ── Helper: configurar cookie de autenticación ─────────────────────────────
function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,                                      // No accesible por JavaScript
    secure: isProduction || process.env.COOKIE_SECURE === "true", // HTTPS solo en prod
    sameSite: isProduction ? "strict" : "lax",          // Protección CSRF
    maxAge: 8 * 60 * 60 * 1000,                         // 8 horas (igual que JWT expiresIn)
    path: "/",
  });
}

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    // Validar input con Zod
    const body = validate(loginSchema, req.body, res);
    if (!body) return;

    const { email, password } = body;

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Tiempo constante para evitar user enumeration:
    // Comparamos la contraseña incluso si el usuario no existe (hash ficticio)
    const hashFicticio = "$2b$10$invalido.hash.para.evitar.timing.attack.aqui00000";
    const hashReal = usuario?.passwordHash || hashFicticio;
    const valid = await bcrypt.compare(password, hashReal);

    if (!usuario || !usuario.activo || !valid) {
      logger.warn("Login fallido", {
        email,
        motivo: !usuario ? "usuario no encontrado" : !usuario.activo ? "inactivo" : "contraseña incorrecta",
        ip: req.ip,
      });
      // Siempre el mismo mensaje para no revelar si el email existe
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    setAuthCookie(res, token);

    logger.info("Login exitoso", { userId: usuario.id, email, rol: usuario.rol, ip: req.ip });

    // No devolver el token en el body — viaja solo en la cookie HttpOnly
    res.json({ usuario: payload });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie("token", { path: "/", httpOnly: true });
  res.json({ message: "Sesión cerrada correctamente" });
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
// Verifica la cookie activa y devuelve los datos del usuario.
// El frontend lo usa al montar la app para restaurar la sesión.
router.get("/me", authMiddleware, (req, res) => {
  res.json({ usuario: req.user });
});

module.exports = router;
