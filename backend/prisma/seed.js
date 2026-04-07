/**
 * seed.js — Inicialización del usuario administrador
 *
 * SEGURIDAD:
 *   - La contraseña NO está hardcodeada. Se lee de la variable de entorno SEED_ADMIN_PASSWORD.
 *   - El email se puede configurar con SEED_ADMIN_EMAIL (default: admin@grupleo.com)
 *   - Si SEED_ADMIN_PASSWORD no está definida, el proceso falla con instrucciones claras.
 *
 * USO:
 *   SEED_ADMIN_PASSWORD="TuContraseñaSegura123!" npm run seed
 *
 *   O agrega SEED_ADMIN_PASSWORD=... a tu .env y ejecuta: npm run seed
 */

require("dotenv/config");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim() || "admin@grupleo.com";
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!password) {
    console.error("\n❌ ERROR: Debes definir SEED_ADMIN_PASSWORD antes de ejecutar el seed.");
    console.error("   Ejemplo:");
    console.error('   SEED_ADMIN_PASSWORD="TuContraseña123!" npm run seed\n');
    console.error("   O agrégala a .env:\n   SEED_ADMIN_PASSWORD=TuContraseña123!\n");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("\n❌ ERROR: SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres.\n");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12); // cost 12 en lugar de 10

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: {},   // Si ya existe no lo pisamos
    create: {
      nombre: process.env.SEED_ADMIN_NOMBRE || "Administrador",
      email,
      passwordHash,
      rol: "OPERACIONES",
    },
  });

  console.log(`\n✅ Usuario seed listo: ${usuario.email} (rol: ${usuario.rol})`);
  console.log("   La contraseña fue tomada de SEED_ADMIN_PASSWORD — no se registra en logs.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
