const { PrismaClient: SQLiteClient } = require("../generated/sqlite");
const { PrismaClient: TiDBClient } = require("../generated/tidb");
const { config } = require("dotenv");

config({ path: ".env.tidb", override: true });

const sqlite = new SQLiteClient({
  datasources: {
    db: { url: "file:./dev.db" },
  },
});

const tidb = new TiDBClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

async function main() {
  const tables = [
    ["product", "Product"],
    ["customer", "Customer"],
    ["order", "Order"],
    ["orderItem", "OrderItem"],
    ["pendingPayment", "PendingPayment"],
  ];

  // Read everything before writing to TiDB.
  const data = {};

  for (const [model, label] of tables) {
    data[model] = await sqlite[model].findMany({
      orderBy: { id: "asc" },
    });
    console.log(`${label}: ${data[model].length} records found`);
  }

  // Refuse to import into a database containing existing records.
  for (const [model] of tables) {
    const count = await tidb[model].count();
    if (count !== 0) {
      throw new Error(
        `TiDB ${model} already has ${count} records. Import stopped.`
      );
    }
  }

  // Preserve IDs and insert parents before children.
  for (const [model, label] of tables) {
    const records = data[model];

    if (records.length) {
      const result = await tidb[model].createMany({
        data: records,
      });
      console.log(`${label}: ${result.count} records imported`);
    }
  }

  console.log("Migration completed successfully!");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await tidb.$disconnect();
  });

