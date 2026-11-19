import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function getLoggedInCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_session")?.value;
  const secret = process.env.CUSTOMER_SESSION_SECRET;

  if (!token || !secret || secret.length < 32) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [idText, expiryText, signature] = parts;

  if (
    !/^[1-9]\d*$/.test(idText) ||
    !/^\d+$/.test(expiryText) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return null;
  }

  const customerId = Number(idText);
  const expiresAt = Number(expiryText);

  if (
    !Number.isSafeInteger(customerId) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return null;
  }

  const expected = createHmac("sha256", secret)
    .update(`${customerId}.${expiresAt}`)
    .digest("hex");

  if (
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex"),
    )
  ) {
    return null;
  }

  return prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, phone: true },
  });
}
