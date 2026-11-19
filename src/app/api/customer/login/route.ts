import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";

const prisma = new PrismaClient();

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function POST(request: Request) {
  try {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.CUSTOMER_TEST_OTP_ENABLED !== "true"
    ) {
      return NextResponse.json(
        { error: "Test OTP login is disabled" },
        { status: 403 },
      );
    }

    const secret = process.env.CUSTOMER_SESSION_SECRET;

    if (!secret || secret.length < 32) {
      return NextResponse.json(
        { error: "Customer session secret is not configured" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const phone = String(body.phone ?? "").trim();
    const otp = String(body.otp ?? "").trim();

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit mobile number" },
        { status: 400 },
      );
    }

    const expectedOtp = process.env.CUSTOMER_TEST_OTP;

    if (!expectedOtp || !/^\d{6}$/.test(expectedOtp)) {
      return NextResponse.json(
        { error: "Test OTP is not configured" },
        { status: 500 },
      );
    }

    const validOtp =
      timingSafeEqual(
        Buffer.from(otp.padEnd(6, " ").slice(0, 6)),
        Buffer.from(expectedOtp),
      ) && /^\d{6}$/.test(otp);

    if (!validOtp) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 });
    }

    const customer = await prisma.customer.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const payload = `${customer.id}.${expiresAt}`;
    const token = `${payload}.${sign(payload, secret)}`;

    const response = NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      },
    });

    response.cookies.set("customer_session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Customer login error:", error);

    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
