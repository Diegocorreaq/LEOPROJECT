require("dotenv/config");

const { validateEnv } = require("./config/env");
validateEnv();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { getAllowedOrigins } = require("./config/origins");
const requestContext = require("./middleware/requestContext");
const csrfProtection = require("./middleware/csrf");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./lib/logger");

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = getAllowedOrigins();

app.use(requestContext);

app.use(
  helmet({
    hsts: process.env.NODE_ENV === "production"
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    hidePoweredBy: true,
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginResourcePolicy: { policy: "same-origin" },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn("Solicitud bloqueada por CORS", { origin });
      const error = new Error(`Origen no permitido por CORS: ${origin}`);
      error.status = 403;
      return callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  }),
);

app.use(cookieParser());
app.use(csrfProtection);
app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Demasiadas solicitudes. Intenta en 15 minutos." },
    skip: () => process.env.NODE_ENV === "test",
  }),
);

app.get("/", (req, res) => {
  res.json({ status: "ok", app: "Grupo Leo API", requestId: req.requestId });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/servicios", require("./routes/servicios"));
app.use("/api/vehiculos", require("./routes/vehiculos"));
app.use("/api/conductores", require("./routes/conductores"));
app.use("/api/clientes", require("./routes/clientes"));
app.use("/api/ubigeos", require("./routes/ubigeos"));
app.use("/api/guias", require("./routes/guias"));
app.use("/api/liquidaciones", require("./routes/liquidaciones"));
app.use("/api/facturas", require("./routes/facturas"));
app.use("/api/dashboard", require("./routes/dashboard"));

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada", requestId: req.requestId });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info("Grupo Leo API iniciada", {
    port: PORT,
    env: process.env.NODE_ENV || "development",
    allowedOrigins,
  });
});
