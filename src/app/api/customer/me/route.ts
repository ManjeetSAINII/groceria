import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const token = (await cookies()).get("customer_session")?.value;
    const secret = process.env.CUSTOMER_SESSION_SECRET;

    if (!token || !secret || secret.length < 32) {
      return NextResponse.json({ customer: null }, { status: 401 });
    }

    const parts = token.split(".");

    if (parts.length !== 3) {
      return NextResponse.json({ customer: null }, { status: 401 });
    }

    const [id, expiry, signature] = parts;
    const payload = `${id}.${expiry}`;

    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    if (
      !/^\d+$/.test(id) ||
      !/^\d+$/.test(expiry) ||
      !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex"),
      ) ||
      Number(expiry) <= Date.now()
    ) {
      return NextResponse.json({ customer: null }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: Number(id) },
      select: { id: true, name: true, phone: true },
    });

    if (!customer) {
      return NextResponse.json({ customer: null }, { status: 401 });
    }

    return NextResponse.json(
      { customer },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Customer session error:", error);

    return NextResponse.json({ customer: null }, { status: 500 });
  }
}
