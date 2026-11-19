import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInCustomer } from "@/lib/customer-session";

export async function GET() {
  try {
    const customer = await getLoggedInCustomer();

    if (!customer) {
      return NextResponse.json(
        { error: "Please log in to view your orders" },
        { status: 401 },
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        customerId: customer.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        customerName: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productName: true,
            price: true,
            quantity: true,
          },
        },
      },
    });

    return NextResponse.json(
      { orders },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Failed to load customer orders:", error);

    return NextResponse.json(
      { error: "Unable to load your orders" },
      { status: 500 },
    );
  }
}
