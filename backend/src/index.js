require("dotenv/config");

const fs = require("fs");
const path = require("path");
const { getCookieSettings, shouldServeFrontend, validateEnv } = require("./config/env");
validateEnv();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { getAllowedOrigins, getServerOrigin, isAllowedOrigin } = require("./config/origins");
const requestContext = require("./middleware/requestContext");
const csrfProtection = require("./middleware/csrf");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./lib/logger");

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = getAllowedOrigins();
const cookieSettings = getCookieSettings();
const serveFrontend = shouldServeFrontend();
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const frontendBuildAvailable = fs.existsSync(frontendIndexPath);
const isServingFrontend = serveFrontend && frontendBuildAvailable;

const corsBaseOptions = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
};

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
  cors((req, callback) => {
    const requestOrigin = req.headers.origin;

    if (!requestOrigin) {
      return callback(null, { ...corsBaseOptions, origin: false });
    }

    if (isAllowedOrigin(requestOrigin, req, allowedOrigins)) {
      return callback(null, { ...corsBaseOptions, origin: true });
    }

    logger.warn("Solicitud bloqueada por CORS", {
      origin: requestOrigin,
      allowedOrigins,
      serverOrigin: getServerOrigin(req),
    });

    const error = new Error(`Origen no permitido por CORS: ${requestOrigin}`);
    error.status = 403;
    return callback(error);
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "Grupo Leo API", requestId: req.requestId });
});

if (!isServingFrontend) {
  app.get("/", (req, res) => {
    res.json({ status: "ok", app: "Grupo Leo API", requestId: req.requestId });
  });
}

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

if (isServingFrontend) {
  app.use(express.static(frontendDistPath));

  app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => {
    res.sendFile(frontendIndexPath, (err) => {
      if (err) next(err);
    });
  });
}

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada", requestId: req.requestId });
});

if (!isServingFrontend) {
  app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada", requestId: req.requestId });
  });
}

app.use(errorHandler);

app.listen(PORT, () => {
  if (isServingFrontend) {
    logger.info("Frontend compilado servido por Express", {
      frontendDistPath,
      frontendIndexPath,
    });
  } else if (serveFrontend) {
    logger.warn("SERVE_FRONTEND=true pero frontend/dist no esta disponible", {
      frontendDistPath,
      frontendIndexPath,
    });
  } else {
    logger.info("SERVE_FRONTEND=false. Express funcionara solo como API", {
      frontendDistPath,
    });
  }

  logger.info("Grupo Leo API iniciada", {
    port: PORT,
    env: process.env.NODE_ENV || "development",
    allowedOrigins,
    cookieSecure: cookieSettings.secure,
    cookieSameSite: cookieSettings.sameSite,
    serveFrontend: isServingFrontend,
  });
});
