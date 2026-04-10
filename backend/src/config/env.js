/**
 * env.js - Validacion centralizada de variables de entorno al arranque.
 *
 * Si faltan variables obligatorias o hay combinaciones inseguras, el proceso
 * termina inmediatamente con un mensaje claro. Nunca arrancar con config rota.
 */

const REQUIRED = ["DATABASE_URL", "JWT_SECRET"];
const JWT_MIN_LENGTH = 32;
const VALID_COOKIE_SAME_SITE = new Set(["lax", "strict", "none"]);

function getTrimmedEnv(name) {
  return typeof process.env[name] === "string" ? process.env[name].trim() : "";
}

function readBooleanEnv(name, defaultValue = false) {
  const raw = getTrimmedEnv(name);

  if (!raw) return defaultValue;
  if (raw === "true") return true;
  if (raw === "false") return false;

  throw new Error(`${name} debe ser "true" o "false". Valor recibido: ${raw}`);
}

function getCookieSameSite() {
  const raw = getTrimmedEnv("COOKIE_SAME_SITE").toLowerCase();

  if (!raw) return "lax";
  if (VALID_COOKIE_SAME_SITE.has(raw)) return raw;

  throw new Error(
    `COOKIE_SAME_SITE debe ser uno de: ${Array.from(VALID_COOKIE_SAME_SITE).join(", ")}. Valor recibido: ${raw}`
  );
}

function getCookieSettings() {
  return {
    secure: readBooleanEnv("COOKIE_SECURE", false),
    sameSite: getCookieSameSite(),
  };
}

function shouldServeFrontend() {
  return readBooleanEnv("SERVE_FRONTEND", false);
}

function validateEnv() {
  const missing = REQUIRED.filter((key) => !getTrimmedEnv(key));

  if (missing.length > 0) {
    console.error(
      `[STARTUP ERROR] Variables de entorno obligatorias faltantes: ${missing.join(", ")}`
    );
    console.error("[STARTUP ERROR] Revisa tu archivo .env basandote en .env.example");
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < JWT_MIN_LENGTH) {
    console.error(
      `[STARTUP ERROR] JWT_SECRET debe tener al menos ${JWT_MIN_LENGTH} caracteres.`
    );
    console.error(
      `[STARTUP ERROR] Genera uno seguro con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
    process.exit(1);
  }

  let cookieSettings;

  try {
    cookieSettings = getCookieSettings();
    shouldServeFrontend();
  } catch (err) {
    console.error(`[STARTUP ERROR] ${err.message}`);
    process.exit(1);
  }

  if (cookieSettings.sameSite === "none" && !cookieSettings.secure) {
    console.error("[STARTUP ERROR] COOKIE_SAME_SITE=none requiere COOKIE_SECURE=true.");
    process.exit(1);
  }

  if (process.env.NODE_ENV === "production") {
    if (!getTrimmedEnv("ALLOWED_ORIGINS")) {
      console.warn(
        "[STARTUP WARN] ALLOWED_ORIGINS no esta definido en produccion. " +
        "CORS bloqueara todos los origenes cruzados."
      );
    }

    if (!cookieSettings.secure) {
      console.warn("[STARTUP WARN] En produccion se recomienda COOKIE_SECURE=true");
    }
  }
}

module.exports = {
  getCookieSameSite,
  getCookieSettings,
  readBooleanEnv,
  shouldServeFrontend,
  validateEnv,
};
