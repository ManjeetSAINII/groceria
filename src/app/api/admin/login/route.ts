import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  const hash = process.env.ADMIN_PASSWORD_HASH;

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
