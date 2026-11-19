require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3100";
const PRODUCT_ID = 17;
const CUSTOMER_ID = 3;

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
    where: { id: PRODUCT_ID },
  });

  if (
    !product ||
    product.name !== "Load Test Product" ||
    product.stock < 1
  ) {
    throw new Error(
      "Safety stop: Test product missing or out of stock"
    );
  }

  const loginResponse = await fetch(
    `${BASE_URL}/api/customer/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "9999900001",
        otp: process.env.CUSTOMER_TEST_OTP,
      }),
    }
  );

  const loginData = await loginResponse.json();

  if (
    !loginResponse.ok ||
    loginData.customer?.id !== CUSTOMER_ID
  ) {
    throw new Error(
      "Safety stop: Test customer login failed"
    );
  }

  const session = loginResponse.headers
    .get("set-cookie")
    ?.match(/customer_session=([^;]+)/)?.[1];

  if (!session) {
    throw new Error("Missing customer session cookie");
  }

  const stockBefore = product.stock;
  const ordersBefore = await prisma.order.count();

  const idempotencyKey = randomUUID();

  const payload = {
    customerName: "Load Test Customer",
    address: "123 Test Street",
    city: "Test City",
    pincode: "135001",
    items: [{ productId: PRODUCT_ID, quantity: 1 }],
    idempotencyKey,
  };

  async function sendOrder() {
    const response = await fetch(
      `${BASE_URL}/api/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `customer_session=${session}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      }
    );

    const data = await response.json();

    return {
      status: response.status,
      orderId: data.orderId ?? null,
      replayed: data.replayed ?? null,
      error: data.error ?? null,
    };
  }

  console.log(
    "Sending 2 simultaneous orders with the same key..."
  );

  const results = await Promise.all([
    sendOrder(),
    sendOrder(),
  ]);

  console.table(results);

  const stockAfter = await prisma.product.findUnique({
    where: { id: PRODUCT_ID },
  });

  const ordersAfter = await prisma.order.count();

  const passed =
    results.every(
      (r) => r.status === 200 || r.status === 201
    ) &&
    results[0].orderId !== null &&
    results[0].orderId === results[1].orderId &&
    results.filter((r) => r.replayed === false).length === 1 &&
    results.filter((r) => r.replayed === true).length === 1 &&
    stockBefore - stockAfter.stock === 1 &&
    ordersAfter - ordersBefore === 1;

  console.log("\nGROCERIA DUPLICATE ORDER TEST");
  console.log("Stock before:", stockBefore);
  console.log("Stock after:", stockAfter.stock);
  console.log("Orders created:", ordersAfter - ordersBefore);
  console.log("Same order ID:", results[0].orderId === results[1].orderId);
  console.log("TEST RESULT:", passed ? "PASS" : "FAIL");

  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("TEST STOPPED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
