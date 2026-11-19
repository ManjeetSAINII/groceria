import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { finalizePayment } from "../lib/finalize-payment";

async function main() {
  const testId = randomUUID();
  const orderIds = [`test_race_A_${testId}`, `test_race_B_${testId}`];

  const paymentIds = [`pay_test_A_${testId}`, `pay_test_B_${testId}`];

  let productId: number | undefined;

  try {
    const product = await prisma.product.create({
      data: {
        name: `Last Stock Test ${testId}`,
        category: "TEST",
        price: 100,
        stock: 1,
        isActive: false,
      },
    });

    productId = product.id;

    for (const razorpayOrderId of orderIds) {
      await prisma.pendingPayment.create({
        data: {
          razorpayOrderId,
          amount: 10000,
          currency: "INR",
          customerName: "Test Customer",
          phone: "9999999999",
          address: "Test Address",
          city: "Test City",
          pincode: "123456",
          itemsJson: JSON.stringify([
            {
              productId,
              productName: product.name,
              price: 100,
              quantity: 1,
            },
          ]),
          status: "PENDING",
        },
      });
    }

    const results = await Promise.allSettled(
      orderIds.map((orderId, index) =>
        finalizePayment(orderId, paymentIds[index]),
      ),
    );

    console.log(
      "Request results:",
      results.map((result) =>
        result.status === "fulfilled"
          ? `SUCCESS: Order #${result.value.id}`
          : `FAILED: ${String(result.reason)}`,
      ),
    );

    const orders = await prisma.order.findMany({
      where: { razorpayOrderId: { in: orderIds } },
    });

    const payments = await prisma.pendingPayment.findMany({
      where: { razorpayOrderId: { in: orderIds } },
    });

    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    console.log("Orders created:", orders.length);
    console.log("Final stock:", updatedProduct.stock);
    console.log(
      "Payment statuses:",
      payments.map((payment) => payment.status),
    );

    const passed =
      orders.length === 1 &&
      updatedProduct.stock === 0 &&
      payments.filter((p) => p.status === "PAID").length === 1 &&
      payments.filter((p) => p.status === "REFUND_REQUIRED").length === 1;

    if (!passed) {
      throw new Error("FAIL: Last-stock concurrency test");
    }

    console.log("PASS: Last stock allocated only once");
  } finally {
    // Remove only records created by this test.
    await prisma.orderItem.deleteMany({
      where: { order: { razorpayOrderId: { in: orderIds } } },
    });

    await prisma.order.deleteMany({
      where: { razorpayOrderId: { in: orderIds } },
    });

    await prisma.pendingPayment.deleteMany({
      where: { razorpayOrderId: { in: orderIds } },
    });

    if (productId !== undefined) {
      await prisma.product.delete({ where: { id: productId } });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
