const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();

  try {
    const integrity = await prisma.$queryRawUnsafe(
      "PRAGMA integrity_check"
    );

    const orders = await prisma.order.count();

    console.log(
      "Database integrity:",
      integrity[0].integrity_check
    );

    console.log("Orders:", orders);

    if (integrity[0].integrity_check === "ok") {
      console.log("TEST RESULT: PASS");
    } else {
      console.log("TEST RESULT: FAIL");
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
