require("dotenv/config");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim() || "admin@grupoleo.com";
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!password) {
    console.error("\nERROR: Debes definir SEED_ADMIN_PASSWORD antes de ejecutar el seed.");
    console.error('Ejemplo: SEED_ADMIN_PASSWORD="TuContrasenaSegura123!" npm run seed\n');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("\nERROR: SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres.\n");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      nombre: process.env.SEED_ADMIN_NOMBRE || "Administrador",
      email,
      passwordHash,
      rol: "ADMIN",
      activo: true,
    },
  });

  console.log(`\nUsuario seed listo: ${usuario.email} (rol: ${usuario.rol})`);
  console.log("La contrasena fue tomada de SEED_ADMIN_PASSWORD y no se registra en logs.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
