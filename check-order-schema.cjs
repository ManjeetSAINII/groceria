const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRawUnsafe(
    'PRAGMA table_info("Order")'
  );

  console.log("Order table columns:");

  for (const column of columns) {
    console.log(column.name);
  }

  console.log(
    "\nidempotencyKey exists:",
    columns.some((column) => column.name === "idempotencyKey")
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
