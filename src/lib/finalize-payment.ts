import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
type SavedItem = {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
};
function isRetryablePaymentError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return error.code === "P2034";
}

export async function finalizePayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
) {
  const pending = await prisma.pendingPayment.findUnique({
    where: { razorpayOrderId },
  });

  if (!pending) {
    throw new Error("Payment order not found");
  }

  if (pending.currency !== "INR") {
    throw new Error("Unexpected payment currency");
  }

  const items = JSON.parse(pending.itemsJson) as SavedItem[];

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.some(
      (item) =>
        !Number.isInteger(item.productId) ||
        !Number.isInteger(item.price) ||
        !Number.isInteger(item.quantity) ||
        item.price < 0 ||
        item.quantity <= 0 ||
        typeof item.productName !== "string",
    )
  ) {
    throw new Error("Invalid saved order items");
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { razorpayOrderId },
        });

        const currentPending = await tx.pendingPayment.findUnique({
          where: { razorpayOrderId },
        });

        if (!currentPending) {
          throw new Error("Payment record not found");
        }

        if (currentPending.status === "PAID") {
          const completedOrder = await tx.order.findUnique({
            where: { razorpayOrderId },
          });

          if (
            completedOrder &&
            completedOrder.razorpayPaymentId === razorpayPaymentId
          ) {
            return completedOrder;
          }

          throw new Error("Paid order not found or payment ID mismatch");
        }

        if (currentPending.status !== "PENDING") {
          throw new Error(
            "Payment is not pending. Manual payment review required.",
          );
        }

        for (const item of items) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity },
            },
            data: {
              stock: { decrement: item.quantity },
            },
          });

          if (updated.count !== 1) {
            throw new Error(`Insufficient stock for ${item.productName}`);
          }
        }
        const order = await tx.order.create({
          data: {
            customerId: currentPending.customerId,
            customerName: currentPending.customerName,
            phone: pending.phone,
            address: pending.address,
            city: pending.city,
            pincode: pending.pincode,
            total: pending.amount / 100,
            paymentMethod: "ONLINE",
            paymentStatus: "PAID",
            status: "PENDING",
            razorpayOrderId,
            razorpayPaymentId,
            items: { create: items },
          },
        });

        await tx.pendingPayment.update({
          where: { razorpayOrderId },
          data: { status: "PAID" },
        });

        return order;
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Insufficient stock")
      ) {
        // The failed transaction has rolled back.
        // Record the payment for refund review.
        await prisma.$transaction(async (tx) => {
          const completedOrder = await tx.order.findUnique({
            where: { razorpayOrderId },
          });

          if (completedOrder) {
            return;
          }

          await tx.pendingPayment.updateMany({
            where: {
              razorpayOrderId,
              status: "PENDING",
            },
            data: {
              status: "REFUND_REQUIRED",
            },
          });
        });

        throw error;
      }

      if (!isRetryablePaymentError(error) || attempt === 3) {
        throw error;
      }

      // Allow a competing transaction time to finish.
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }

  throw new Error("Payment finalization retries exhausted");
}
