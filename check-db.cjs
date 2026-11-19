const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const db = await prisma.$queryRawUnsafe("PRAGMA database_list");
  const integrity = await prisma.$queryRawUnsafe("PRAGMA integrity_check");

  console.log("Database location:", db);
  console.log("Integrity check:", integrity);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
