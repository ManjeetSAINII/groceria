require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const path = require("node:path");

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3100";
const COUNT = 1;
const CUSTOMER_PHONE = "9999900001";
const PRODUCT_ID = 17;

async function main() {
  // Confirm the test runner is using the isolated database.
  const expected = path.resolve("load-test/test.db");
  const databases = await prisma.$queryRawUnsafe("PRAGMA database_list");
  const actual = databases.find(db => db.name === "main")?.file;

  if (!actual || path.resolve(actual).toLowerCase() !== expected.toLowerCase()) {
    throw new Error("Safety stop: Not connected to the test database");
  }

  // Obtain a real session cookie from the test server.
  const loginResponse = await fetch(`${BASE_URL}/api/customer/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: CUSTOMER_PHONE,
      otp: process.env.CUSTOMER_TEST_OTP
    })
  });

  const loginData = await loginResponse.json();

  if (!loginResponse.ok || loginData.customer?.id !== 3) {
    throw new Error(
      `Safety stop: Login failed or unexpected customer ID (${loginResponse.status})`
    );
  }

  const setCookie = loginResponse.headers.get("set-cookie");
  const session = setCookie?.match(/customer_session=([^;]+)/)?.[1];

  if (!session) {
    throw new Error("Login did not return a customer session cookie");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: 3 }
  });

  const product = await prisma.product.findUnique({
    where: { id: PRODUCT_ID }
  });

 if (!customer || !product || product.stock < 0) {
  throw new Error("Test customer/product missing or insufficient stock");
}
  const cookie = `customer_session=${session}`;
  const stockBefore = product.stock;
  const ordersBefore = await prisma.order.count();

  console.log(`Sending ${COUNT} simultaneous COD orders...`);

  const started = Date.now();

  const results = await Promise.all(
    Array.from({ length: COUNT }, async (_, i) => {
      const start = Date.now();

      try {
        const response = await fetch(`${BASE_URL}/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie
          },
          body: JSON.stringify({
            customerName: "Load Test Customer",
            address: "123 Test Street",
            city: "Test City",
            pincode: "135001",
            items: [{ productId: PRODUCT_ID, quantity: 1 }]
          }),
          signal: AbortSignal.timeout(30000)
        });

        const data = await response.json().catch(() => ({}));

        return {
          request: i + 1,
          status: response.status,
          ms: Date.now() - start,
          orderId: data.orderId ?? null,
          error: data.error ?? null
        };
      } catch (error) {
        return {
          request: i + 1,
          status: "NETWORK_ERROR",
          ms: Date.now() - start,
          orderId: null,
          error: error.message
        };
      }
    })
  );

  console.table(results);

  const stockAfter = await prisma.product.findUnique({
    where: { id: PRODUCT_ID }
  });

  const ordersAfter = await prisma.order.count();

  const successful = results.filter(r => r.status === 201).length;
  const failed = COUNT - successful;

  console.log("\nGROCERIA LOAD TEST RESULTS");
  console.log("Requests:", COUNT);
  console.log("Successful:", successful);
  console.log("Failed:", failed);
  console.log("Total duration:", Date.now() - started, "ms");
  console.log("Stock before:", stockBefore);
  console.log("Stock after:", stockAfter.stock);
  console.log("Orders created:", ordersAfter - ordersBefore);
  console.log("Stock correct:", stockBefore - stockAfter.stock === successful);
  console.log("Order count correct:", ordersAfter - ordersBefore === successful);
}

main()
  .catch(error => {
    console.error("TEST STOPPED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());



