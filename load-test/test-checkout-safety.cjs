require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3100";

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
    throw new Error("Safety stop: Wrong database");
  }

  const product = await prisma.product.findUnique({
    where: { id: 17 },
  });

  if (
    !product ||
    product.name !== "Load Test Product" ||
    product.stock < 4
  ) {
    throw new Error(
      "Safety stop: Test product must have at least 4 units"
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
    loginData.customer?.id !== 3
  ) {
    throw new Error("Test customer login failed");
  }

  const session = loginResponse.headers
    .get("set-cookie")
    ?.match(/customer_session=([^;]+)/)?.[1];

  if (!session) {
    throw new Error("Missing customer session");
  }

  const key1 = randomUUID();
  const key2 = randomUUID();

  async function sendOrder(key, quantity) {
    const response = await fetch(
      `${BASE_URL}/api/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `customer_session=${session}`,
        },
        body: JSON.stringify({
          customerName: "Load Test Customer",
          address: "123 Test Street",
          city: "Test City",
          pincode: "135001",
          items: [
            { productId: 17, quantity },
          ],
          idempotencyKey: key,
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    return {
      status: response.status,
      ...(await response.json()),
    };
  }

  const stockBefore = product.stock;
  const ordersBefore = await prisma.order.count();

  console.log("1. Creating original order...");
  const original = await sendOrder(key1, 1);

  if (original.status !== 201) {
    throw new Error(
      "Original order failed: " + JSON.stringify(original)
    );
  }

  console.log("2. Reusing key with changed quantity...");
  const conflict = await sendOrder(key1, 2);

  console.log("3. Creating new checkout with new key...");
  const fresh = await sendOrder(key2, 1);

  const stockAfter = await prisma.product.findUnique({
    where: { id: 17 },
  });

  const ordersAfter = await prisma.order.count();

  const passed =
    conflict.status === 409 &&
    fresh.status === 201 &&
    fresh.orderId !== original.orderId &&
    stockBefore - stockAfter.stock === 2 &&
    ordersAfter - ordersBefore === 2;

  console.log("\nFINAL CHECKOUT SAFETY TEST");
  console.log("Original order:", original.status, original.orderId);
  console.log("Changed request:", conflict.status, conflict.error);
  console.log("New checkout:", fresh.status, fresh.orderId);
  console.log("Stock before:", stockBefore);
  console.log("Stock after:", stockAfter.stock);
  console.log("Orders created:", ordersAfter - ordersBefore);
  console.log("TEST RESULT:", passed ? "PASS" : "FAIL");

  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("TEST STOPPED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
