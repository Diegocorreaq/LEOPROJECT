/**
 * env.js — Validación centralizada de variables de entorno al arranque.
 *
 * Si faltan variables obligatorias o el JWT_SECRET es inseguro, el proceso
 * termina inmediatamente con un mensaje claro. Nunca arrancar con config rota.
 */

const REQUIRED = ["DATABASE_URL", "JWT_SECRET"];
const JWT_MIN_LENGTH = 32;

function validateEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());

  if (missing.length > 0) {
    console.error(
      `[STARTUP ERROR] Variables de entorno obligatorias faltantes: ${missing.join(", ")}`
    );
    console.error(
      `[STARTUP ERROR] Revisa tu archivo .env basándote en .env.example`
    );
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

  if (process.env.NODE_ENV === "production") {
    if (!process.env.ALLOWED_ORIGINS) {
      console.warn(
        "[STARTUP WARN] ALLOWED_ORIGINS no está definido en producción. " +
        "CORS bloqueará todos los orígenes cruzados."
      );
    }
    if (!process.env.COOKIE_SECURE || process.env.COOKIE_SECURE !== "true") {
      console.warn(
        "[STARTUP WARN] En producción se recomienda COOKIE_SECURE=true"
      );
    }
  }
}

module.exports = { validateEnv };
