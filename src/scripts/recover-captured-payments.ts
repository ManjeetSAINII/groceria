import "dotenv/config";
import Razorpay from "razorpay";
import { prisma } from "../lib/prisma";
import { finalizePayment } from "../lib/finalize-payment";

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are missing");
  }

  if (!keyId.startsWith("rzp_test_")) {
    throw new Error("Recovery is restricted to Razorpay Test Mode");
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  const pendingPayments = await prisma.pendingPayment.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  console.log("Pending payments:", pendingPayments.length);

  for (const pending of pendingPayments) {
    console.log("\nChecking:", pending.razorpayOrderId);

    try {
      const existingOrder = await prisma.order.findUnique({
        where: { razorpayOrderId: pending.razorpayOrderId },
      });

      if (existingOrder) {
        console.log("SKIPPED: Local order already exists");
        continue;
      }

      const response = await razorpay.orders.fetchPayments(
        pending.razorpayOrderId,
      );

      const capturedPayments = (response.items ?? []).filter(
        (payment) =>
          payment.status === "captured" &&
          payment.order_id === pending.razorpayOrderId &&
          Number(payment.amount) === pending.amount &&
          payment.currency === pending.currency,
      );

      if (capturedPayments.length !== 1) {
        console.log(
          "SKIPPED: Expected exactly one matching captured payment; found",
          capturedPayments.length,
        );
        continue;
      }

      const capturedPayment = capturedPayments[0];

      // Independently verify the payment before finalization.
      const verifiedPayment = await razorpay.payments.fetch(capturedPayment.id);

      if (
        verifiedPayment.status !== "captured" ||
        verifiedPayment.order_id !== pending.razorpayOrderId ||
        Number(verifiedPayment.amount) !== pending.amount ||
        verifiedPayment.currency !== pending.currency
      ) {
        console.log("SKIPPED: Payment verification failed");
        continue;
      }

      // Only finalize if explicitly enabled.
      if (process.env.ENABLE_PAYMENT_RECOVERY !== "true") {
        console.log("DRY RUN: Verified captured payment. No order created.");
        continue;
      }

      const order = await finalizePayment(
        pending.razorpayOrderId,
        verifiedPayment.id,
      );

      console.log("RECOVERED: Order #", order.id);
    } catch (error) {
      console.error(
        "REVIEW REQUIRED:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log("\nRecovery check finished.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
