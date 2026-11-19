import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  const hash = process.env.ADMIN_PASSWORD_HASH;
  console.log("Admin login diagnostics:", {
    hashPresent: Boolean(hash),
    hashLength: hash?.length,
    hashFormatValid: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash ?? ""),
    passwordReceived: typeof password === "string",
  });
  if (
    typeof password !== "string" ||
    !hash ||
    !(await bcrypt.compare(password, hash))
  ) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await createSession();

  return NextResponse.json({ ok: true });
}
