import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";
import { finalizePayment } from "@/lib/finalize-payment";

export async function POST(request: Request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      return NextResponse.json(
        { error: "Webhook secret is not configured" },
        { status: 500 },
      );
    }

    const signature = request.headers.get("x-razorpay-signature");

    if (!signature || !/^[a-fA-F0-9]{64}$/.test(signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    const rawBody = await request.text();

    const expectedSignature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const isValid = timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex"),
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 401 },
      );
    }

    const event = JSON.parse(rawBody);

    console.log("Verified Razorpay webhook:", event.event);

    if (event.event !== "payment.captured") {
      return NextResponse.json({ received: true });
    }

    const eventPayment = event.payload?.payment?.entity;
    const paymentId = eventPayment?.id;
    const orderId = eventPayment?.order_id;

    if (typeof paymentId !== "string" || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Invalid payment event" },
        { status: 400 },
      );
    }

    const pending = await prisma.pendingPayment.findUnique({
      where: { razorpayOrderId: orderId },
    });

    if (!pending) {
      console.error("Unknown Razorpay order:", orderId);
      return NextResponse.json(
        { error: "Payment order not found" },
        { status: 404 },
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay API keys are not configured" },
        { status: 500 },
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Verify the payment independently with Razorpay.
    const payment = await razorpay.payments.fetch(paymentId);

    if (
      payment.order_id !== orderId ||
      payment.status !== "captured" ||
      Number(payment.amount) !== pending.amount ||
      payment.currency !== pending.currency
    ) {
      return NextResponse.json(
        { error: "Payment details do not match" },
        { status: 400 },
      );
    }

    const order = await finalizePayment(orderId, paymentId);

    console.log("Webhook finalized order:", order.id);

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    return NextResponse.json(
      { error: "Unable to process webhook" },
      { status: 500 },
    );
  }
}
