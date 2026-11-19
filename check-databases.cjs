const { PrismaClient: S } = require("./generated/sqlite");
const { PrismaClient: T } = require("./generated/tidb");

require("dotenv").config({ path: ".env.tidb", override: true });

const s = new S({
  datasources: { db: { url: "file:./dev.db" } }
});

const t = new T({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function main() {
  console.log("SQLite products:", await s.product.count());
  console.log("TiDB products:", await t.product.count());
}

main()
  .catch(console.error)
  .finally(async () => {
    await s.$disconnect();
    await t.$disconnect();
  });
