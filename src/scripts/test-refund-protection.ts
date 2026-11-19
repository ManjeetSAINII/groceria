import { prisma } from "../lib/prisma";
import { finalizePayment } from "../lib/finalize-payment";

async function main() {
  const testOrderId = "order_local_refund_test";

  // Use an existing product only for the test data.
  const product = await prisma.product.findFirst({
    where: { isActive: true },
  });

  if (!product) {
    throw new Error("No active product found");
  }

  // Create a simulated payment already flagged for refund.
  // No Razorpay API call is made.
  const pending = await prisma.pendingPayment.create({
    data: {
      razorpayOrderId: testOrderId,
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
      status: "REFUND_REQUIRED",
    },
  });

  try {
    await finalizePayment(pending.razorpayOrderId, "pay_local_refund_test");

    throw new Error("TEST FAILED: Order was incorrectly created");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "Payment is not pending. Manual payment review required."
    ) {
      console.log("PASS: Refund-flagged payment was blocked");
    } else {
      throw error;
    }
  } finally {
    await prisma.pendingPayment.delete({
      where: { razorpayOrderId: testOrderId },
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
