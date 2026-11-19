import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInCustomer } from "@/lib/customer-session";

export async function PATCH(request: Request) {
  try {
    const customer = await getLoggedInCustomer();

    if (!customer) {
      return NextResponse.json(
        { error: "Please log in to update your profile" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const name = body?.name;

    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 80
    ) {
      return NextResponse.json(
        { error: "Name must contain 2 to 80 characters" },
        { status: 400 },
      );
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    return NextResponse.json(
      { customer: updatedCustomer },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Profile update failed:", error);

    return NextResponse.json(
      { error: "Unable to update profile" },
      { status: 500 },
    );
  }
}
