import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { finalizePayment } from "../lib/finalize-payment";

async function main() {
  const testId = randomUUID();
  const razorpayOrderId = `order_local_stock_${testId}`;
  const razorpayPaymentId = `pay_local_stock_${testId}`;

  // Create a temporary product with zero stock.
  const product = await prisma.product.create({
    data: {
      name: "Temporary Stock Test",
      category: "TEST",
      price: 1,
      stock: 0,
      isActive: false,
    },
  });

  try {
    // Simulated payment record; no Razorpay API call.
    await prisma.pendingPayment.create({
      data: {
        razorpayOrderId,
        amount: 100,
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
            price: 1,
            quantity: 1,
          },
        ]),
        status: "PENDING",
      },
    });

    let stockErrorReceived = false;

    try {
      await finalizePayment(razorpayOrderId, razorpayPaymentId);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Insufficient stock")
      ) {
        stockErrorReceived = true;
      } else {
        throw error;
      }
    }

    const pending = await prisma.pendingPayment.findUniqueOrThrow({
      where: { razorpayOrderId },
    });

    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
    });

    const unchangedProduct = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });

    if (
      !stockErrorReceived ||
      pending.status !== "REFUND_REQUIRED" ||
      order !== null ||
      unchangedProduct.stock !== 0
    ) {
      throw new Error("TEST FAILED: Incorrect refund status, order, or stock");
    }

    console.log("PASS: Insufficient stock detected");
    console.log("PASS: Payment marked REFUND_REQUIRED");
    console.log("PASS: No order created");
    console.log("PASS: Product stock unchanged");
  } finally {
    // Remove only records created by this test.
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
