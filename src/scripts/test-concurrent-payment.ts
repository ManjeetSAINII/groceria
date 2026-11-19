import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { finalizePayment } from "../lib/finalize-payment";

async function main() {
  const testId = randomUUID();
  const razorpayOrderId = `order_local_concurrent_${testId}`;
  const razorpayPaymentId = `pay_local_concurrent_${testId}`;

  // Temporary product with 5 units.
  const product = await prisma.product.create({
    data: {
      name: "Temporary Concurrent Test",
      category: "TEST",
      price: 10,
      stock: 5,
      isActive: false,
    },
  });

  try {
    await prisma.pendingPayment.create({
      data: {
        razorpayOrderId,
        amount: 1000,
        currency: "INR",
        customerName: "Test Customer",
        phone: "9999999999",
        address: "Test Address",
        city: "Test City",
        pincode: "123456",
        itemsJson: JSON.stringify([
          {
            productId: product.id,
            productName: product.name,
            price: 10,
            quantity: 1,
          },
        ]),
        status: "PENDING",
      },
    });

    // Simulate checkout verification and webhook
    // arriving simultaneously.
    const results = await Promise.allSettled([
      finalizePayment(razorpayOrderId, razorpayPaymentId),
      finalizePayment(razorpayOrderId, razorpayPaymentId),
    ]);

    const orders = await prisma.order.findMany({
      where: { razorpayOrderId },
    });

    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    const pending = await prisma.pendingPayment.findUniqueOrThrow({
      where: { razorpayOrderId },
    });

    console.log(
      "Request results:",
      results.map((result) =>
        result.status === "fulfilled"
          ? `SUCCESS: Order #${result.value.id}`
          : `ERROR: ${String(result.reason)}`,
      ),
    );

    console.log("Orders created:", orders.length);
    console.log("Final stock:", updatedProduct.stock);
    console.log("Payment status:", pending.status);

    if (
      orders.length !== 1 ||
      updatedProduct.stock !== 4 ||
      pending.status !== "PAID"
    ) {
      throw new Error("TEST FAILED: Concurrent payment state is incorrect");
    }

    console.log("PASS: One order, one stock deduction, PAID status");

    if (results.some((result) => result.status === "rejected")) {
      console.log(
        "WARNING: One request failed. Retry handling still needs improvement.",
      );
    }
  } finally {
    // Remove only records created by this test.
    const orders = await prisma.order.findMany({
      where: { razorpayOrderId },
      select: { id: true },
    });

    for (const order of orders) {
      await prisma.orderItem.deleteMany({
        where: { orderId: order.id },
      });
    }

    await prisma.order.deleteMany({
      where: { razorpayOrderId },
    });

    await prisma.pendingPayment.deleteMany({
      where: { razorpayOrderId },
    });

    await prisma.product.delete({
      where: { id: product.id },
    });
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
