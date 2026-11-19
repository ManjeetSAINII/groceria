import { finalizePayment } from "../lib/finalize-payment";

async function main() {
  const razorpayOrderId = "order_U0lBnjqXFAuWwp";
  const razorpayPaymentId = "pay_U0lByuGEEtaegu";

  const first = await finalizePayment(razorpayOrderId, razorpayPaymentId);

  const second = await finalizePayment(razorpayOrderId, razorpayPaymentId);

  console.log("First order ID:", first.id);
  console.log("Second order ID:", second.id);
  console.log("Same order:", first.id === second.id);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
