import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const orderId = Number(body?.orderId);
    const phone = body?.phone;

    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0 ||
      typeof phone !== "string" ||
      !/^[0-9]{10}$/.test(phone.trim())
    ) {
      return NextResponse.json(
        { error: "Enter a valid order number and 10-digit phone number" },
        { status: 400 },
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        phone: phone.trim(),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found. Check your order number and phone." },
        { status: 404 },
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Order tracking failed:", error);

    return NextResponse.json(
      { error: "Unable to track order right now" },
      { status: 500 },
    );
  }
}
