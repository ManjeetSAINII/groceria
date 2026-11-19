const { PrismaClient } = require("@prisma/client");

async function check(label, url) {
  process.env.DATABASE_URL = url;

  const prisma = new PrismaClient();

  try {
    const [products, customers, orders, orderItems] =
      await Promise.all([
        prisma.product.count(),
        prisma.customer.count(),
        prisma.order.count(),
        prisma.orderItem.count(),
      ]);

    return {
      database: label,
      products,
      customers,
      orders,
      orderItems,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const backup = await check(
    "Backup",
    "file:../prisma/dev-backup-20261118-142220.db"
  );

  const live = await check(
    "Live",
    "file:../prisma/dev.db"
  );

  console.table([backup, live]);

  const passed =
    backup.products === live.products &&
    backup.customers === live.customers &&
    backup.orders === live.orders &&
    backup.orderItems === live.orderItems;

  console.log(
    "DATA PRESERVATION:",
    passed ? "PASS" : "CHECK REQUIRED"
  );

  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
