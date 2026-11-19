const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.$queryRawUnsafe("PRAGMA database_list");
    console.log(
      rows.map((row) => ({
        name: row.name,
        file: row.file,
      }))
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
