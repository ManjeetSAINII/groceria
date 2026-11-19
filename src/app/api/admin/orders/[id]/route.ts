import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-auth";

const allowedStatuses = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const orderId = Number(id);

  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const body = await request.json();

    if (
      typeof body.status !== "string" ||
      !allowedStatuses.includes(body.status)
    ) {
      return NextResponse.json(
        { error: "Invalid order status" },
        { status: 400 },
      );
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: body.status },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Order status update failed:", error);

    return NextResponse.json(
      { error: "Could not update order status" },
      { status: 400 },
    );
  }
}
