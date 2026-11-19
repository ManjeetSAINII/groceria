import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";
import { finalizePayment } from "@/lib/finalize-payment";
import { getLoggedInCustomer } from "@/lib/customer-session";
export async function POST(request: Request) {
  const customer = await getLoggedInCustomer();

  if (!customer) {
    return NextResponse.json(
      { error: "Please log in to verify your payment" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(razorpay_signature)
    ) {
      return NextResponse.json(
        { error: "Invalid payment details" },
        { status: 400 },
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const keyId = process.env.RAZORPAY_KEY_ID;

    if (!secret || !keyId) {
      return NextResponse.json(
        { error: "Razorpay is not configured" },
        { status: 500 },
      );
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (
      !timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(razorpay_signature, "hex"),
      )
    ) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 },
      );
    }

    const pending = await prisma.pendingPayment.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!pending) {
      return NextResponse.json(
        { error: "Payment order not found" },
        { status: 404 },
      );
    }
    if (pending.customerId !== customer.id) {
      return NextResponse.json(
        { error: "Payment order not found" },
        { status: 404 },
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: secret,
    });

    // Confirm payment directly with Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== razorpay_order_id ||
      payment.status !== "captured" ||
      Number(payment.amount) !== pending.amount ||
      payment.currency !== pending.currency
    ) {
      return NextResponse.json(
        {
          error: "Payment has not been captured or does not match",
        },
        { status: 400 },
      );
    }

    // Create the order using shared payment logic
    const order = await finalizePayment(razorpay_order_id, razorpay_payment_id);

    return NextResponse.json({
      verified: true,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Payment verification failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error &&
          error.message.startsWith("Insufficient stock")
            ? "Payment received, but stock is unavailable. Contact support for a refund."
            : "Unable to finalize payment. Please contact support if money was deducted.",
      },
      { status: 500 },
    );
  }
}
