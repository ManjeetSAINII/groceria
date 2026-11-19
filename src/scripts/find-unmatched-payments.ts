import { prisma } from "../lib/prisma";

async function main() {
  const payments = await prisma.pendingPayment.findMany({
    where: { status: "PAID" },
    select: {
      id: true,
      razorpayOrderId: true,
      status: true,
      amount: true,
    },
  });

  for (const payment of payments) {
    const order = await prisma.order.findUnique({
      where: {
        razorpayOrderId: payment.razorpayOrderId,
      },
      select: { id: true },
    });

    if (!order) {
      console.log("UNMATCHED PAYMENT FOUND:");
      console.log(payment);
    }
  }

  console.log("Check completed.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
