import "dotenv/config";
import Razorpay from "razorpay";
import { prisma } from "../lib/prisma";

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay API credentials are missing");
  }

  if (!keyId.startsWith("rzp_test_")) {
    throw new Error("This report is restricted to Razorpay Test Mode");
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  // Read unresolved payment records without changing them.
  const payments = await prisma.pendingPayment.findMany({
    where: {
      status: {
        in: ["PENDING", "REFUND_REQUIRED"],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("Unresolved payment records:", payments.length);

  for (const pending of payments) {
    console.log("\n------------------------------");
    console.log("Razorpay Order ID:", pending.razorpayOrderId);
    console.log("Local status:", pending.status);
    console.log("Expected amount: ₹", pending.amount / 100);

    try {
      const existingOrder = await prisma.order.findUnique({
        where: { razorpayOrderId: pending.razorpayOrderId },
      });

      if (existingOrder) {
        console.log("Local order:", existingOrder.id);
      } else {
        console.log("Local order: NOT FOUND");
      }

      const paymentsResponse = await razorpay.orders.fetchPayments(
        pending.razorpayOrderId,
      );

      const attempts = paymentsResponse.items ?? [];

      const captured = attempts.filter(
        (payment) =>
          payment.status === "captured" &&
          Number(payment.amount) === pending.amount &&
          payment.currency === pending.currency &&
          payment.order_id === pending.razorpayOrderId,
      );

      console.log("Razorpay payment attempts:", attempts.length);
      console.log("Matching captured payments:", captured.length);

      if (captured.length > 0 && !existingOrder) {
        console.log("ACTION REQUIRED: Captured payment has no local order.");
        console.log(
          "Review payment IDs:",
          captured.map((payment) => payment.id).join(", "),
        );
      } else if (captured.length === 0 && pending.status === "PENDING") {
        console.log("No matching captured payment found.");
      } else if (pending.status === "REFUND_REQUIRED") {
        console.log("ACTION REQUIRED: Review refund status.");
      } else {
        console.log("Review local payment/order consistency.");
      }
    } catch (error) {
      console.error(
        "Unable to inspect this payment:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log("\nRecovery report completed. No records modified.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
