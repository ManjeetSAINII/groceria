require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const path = require("node:path");

const prisma = new PrismaClient();

async function main() {
  const expected = path.resolve("load-test/test.db");

  const databases = await prisma.$queryRawUnsafe(
    "PRAGMA database_list"
  );

  const actual = databases.find(
    (db) => db.name === "main"
  )?.file;

  if (
    !actual ||
    path.resolve(actual).toLowerCase() !==
      expected.toLowerCase()
  ) {
    throw new Error(
      "Safety stop: Not connected to the test database"
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: 17 },
  });

  if (!product || product.name !== "Load Test Product") {
    throw new Error(
      "Safety stop: Unexpected test product"
    );
  }

  const updated = await prisma.product.update({
    where: { id: 17 },
    data: { stock: 10 },
  });

  console.log("Test product:", updated.name);
  console.log("Test stock:", updated.stock);
}

main()
  .catch((error) => {
    console.error("TEST STOPPED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
