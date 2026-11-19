import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select an image" },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image must be under 5 MB" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    let extension: string | null = null;

    if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      extension = "jpg";
    } else if (
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      extension = "png";
    } else if (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    ) {
      extension = "webp";
    }

    if (!extension) {
      return NextResponse.json(
        { error: "Only JPG, PNG and WebP images are allowed" },
        { status: 400 },
      );
    }

    const filename = `${randomUUID()}.${extension}`;
    const folder = path.join(process.cwd(), "public", "uploads");

    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, filename), bytes, {
      flag: "wx",
    });

    return NextResponse.json({
      imageUrl: `/uploads/${filename}`,
    });
  } catch (error) {
    console.error("Image upload failed:", error);

    return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
  }
}
