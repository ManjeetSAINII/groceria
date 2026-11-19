import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function parseProduct(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  const price = Number(body.price),
    stock = Number(body.stock);
  if (
    !name ||
    name.length > 150 ||
    !category ||
    category.length > 100 ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    !Number.isSafeInteger(stock) ||
    stock < 0
  )
    return null;
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 5000)
      : "";
  const imageUrl =
    typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

  const isExternalImage = /^https?:\/\/\S+$/i.test(imageUrl);

  const isUploadedImage = /^\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(
    imageUrl,
  );

  if (
    imageUrl &&
    (imageUrl.length > 2000 || (!isExternalImage && !isUploadedImage))
  ) {
    return null;
  }

  return {
    name,
    category,
    price,
    stock,
    description,
    imageUrl,
    isActive: body.isActive !== false,
  };
}
export async function GET() {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    await prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
  );
}
export async function POST(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const data = body && typeof body === "object" ? parseProduct(body) : null;
  if (!data)
    return NextResponse.json(
      { error: "Check product name, category, price, stock and image URL" },
      { status: 400 },
    );
  return NextResponse.json(await prisma.product.create({ data }), {
    status: 201,
  });
}
export { parseProduct };
