// Cargar .env ANTES de cualquier otro módulo
require("dotenv/config");

// Validar variables de entorno al arranque (falla segura si faltan)
const { validateEnv } = require("./config/env");
validateEnv();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./lib/logger");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Seguridad: Helmet (headers HTTP seguros) ────────────────────────────────
app.use(
  helmet({
    // Habilitar HSTS solo en producción
    hsts: process.env.NODE_ENV === "production"
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    // Deshabilitar X-Powered-By (no queremos revelar Express)
    hidePoweredBy: true,
    // Content Security Policy básico — ajustar si se sirven assets desde Express
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);

// ── CORS — solo orígenes permitidos ────────────────────────────────────────
// En desarrollo: localhost:5173 (Vite)
// En producción: lista desde env var ALLOWED_ORIGINS (separados por coma)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (herramientas CLI, Postman, mismo servidor)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn("Solicitud bloqueada por CORS", { origin });
      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true, // Requerido para cookies HttpOnly
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Cookies HttpOnly ────────────────────────────────────────────────────────
app.use(cookieParser());

// ── Parser JSON con límite de tamaño ───────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── Rate limit global (protección básica anti-flood) ───────────────────────
// El rate limit específico de login está en routes/auth.js
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500,                  // máx 500 requests por IP / ventana
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intenta en 15 minutos." },
    skip: () => process.env.NODE_ENV === "test",
  })
);

// ── Health check (sin auth, sin rate limit específico) ─────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", app: "Grupo Leo API" });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth",       require("./routes/auth"));
app.use("/api/servicios",  require("./routes/servicios"));
app.use("/api/vehiculos",  require("./routes/vehiculos"));
app.use("/api/conductores",require("./routes/conductores"));
app.use("/api/clientes",   require("./routes/clientes"));
app.use("/api/guias",      require("./routes/guias"));
app.use("/api/liquidaciones", require("./routes/liquidaciones"));
app.use("/api/facturas",  require("./routes/facturas"));

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// ── Error handler centralizado (DEBE SER ÚLTIMO) ───────────────────────────
app.use(errorHandler);

// ── Arranque ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Grupo Leo API iniciada`, { port: PORT, env: process.env.NODE_ENV || "development" });
});
