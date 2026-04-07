require("dotenv/config");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const usuario = await prisma.usuario.upsert({
    where: { email: "gean@grupleo.com" },
    update: {},
    create: {
      nombre: "Gean",
      email: "gean@grupleo.com",
      passwordHash,
      rol: "OPERACIONES",
    },
  });

  console.log(`✅ Usuario seed creado: ${usuario.email} / admin123 (rol: ${usuario.rol})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
