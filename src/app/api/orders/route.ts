import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueOrder, OrderQueueFullError } from "@/lib/order-queue";

async function getLoggedInCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_session")?.value;
  const secret = process.env.CUSTOMER_SESSION_SECRET;

  if (!token || !secret || secret.length < 32) return null;

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
    select: { id: true, phone: true },
  });
}

class StockConflictError extends Error {}

class IdempotencyConflictError extends Error {
  constructor() {
    super("This checkout key was already used for a different order");
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

type CheckoutItem = {
  productId: number;
  quantity: number;
};

type CheckoutDetails = {
  customerId: number;
  customerName: string;
  address: string;
  city: string;
  pincode: string;
  items: CheckoutItem[];
  idempotencyKey: string;
};

async function findMatchingOrder(details: CheckoutDetails) {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: details.idempotencyKey },
    include: { items: true },
  });

  if (!existing) return null;

  const existingItems = existing.items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }))
    .sort((a, b) => a.productId - b.productId);

  const sameRequest =
    existing.customerId === details.customerId &&
    existing.customerName === details.customerName &&
    existing.address === details.address &&
    existing.city === details.city &&
    existing.pincode === details.pincode &&
    existing.paymentMethod === "COD" &&
    JSON.stringify(existingItems) === JSON.stringify(details.items);

  if (!sameRequest) {
    throw new IdempotencyConflictError();
  }

  return {
    orderId: existing.id,
    replayed: true,
  };
}

export async function POST(req: Request) {
  let checkout: CheckoutDetails | null = null;

  try {
    const customer = await getLoggedInCustomer();

    if (!customer) {
      return NextResponse.json(
        { error: "Please log in before placing an order" },
        { status: 401 },
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request" },
        { status: 400 },
      );
    }

    const data =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};

    const { customerName, address, city, pincode, items, idempotencyKey } =
      data;

    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      typeof address !== "string" ||
      !address.trim() ||
      typeof city !== "string" ||
      !city.trim() ||
      typeof pincode !== "string" ||
      !/^\d{6}$/.test(pincode) ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50 ||
      typeof idempotencyKey !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(idempotencyKey)
    ) {
      return NextResponse.json(
        { error: "Invalid checkout details or checkout key" },
        { status: 400 },
      );
    }

    const quantities = new Map<number, number>();

    for (const item of items) {
      if (
        !item ||
        !Number.isSafeInteger(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.productId <= 0 ||
        item.quantity <= 0 ||
        item.quantity > 100
      ) {
        return NextResponse.json(
          { error: "Invalid product quantity" },
          { status: 400 },
        );
      }

      const nextQuantity =
        (quantities.get(item.productId) || 0) + item.quantity;

      if (nextQuantity > 100) {
        return NextResponse.json(
          { error: "Invalid product quantity" },
          { status: 400 },
        );
      }

      quantities.set(item.productId, nextQuantity);
    }

    const normalizedItems = [...quantities.entries()]
      .sort(([a], [b]) => a - b)
      .map(([productId, quantity]) => ({
        productId,
        quantity,
      }));

    checkout = {
      customerId: customer.id,
      customerName: customerName.trim(),
      address: address.trim(),
      city: city.trim(),
      pincode,
      items: normalizedItems,
      idempotencyKey,
    };

    const details = checkout;

    const result = await queueOrder(async () => {
      const existing = await findMatchingOrder(details);

      if (existing) return existing;

      const order = await prisma.$transaction(async (tx) => {
        const orderItems: {
          productId: number;
          productName: string;
          price: number;
          quantity: number;
        }[] = [];

        let total = 0;

        for (const { productId, quantity } of details.items) {
          const product = await tx.product.findUnique({
            where: { id: productId },
          });

          if (!product || !product.isActive) {
            throw new StockConflictError("A product is no longer available");
          }

          const updated = await tx.product.updateMany({
            where: {
              id: productId,
              isActive: true,
              stock: { gte: quantity },
            },
            data: {
              stock: { decrement: quantity },
            },
          });

          if (updated.count !== 1) {
            throw new StockConflictError(
              `Not enough stock for ${product.name}`,
            );
          }

          total += product.price * quantity;

          orderItems.push({
            productId,
            productName: product.name,
            price: product.price,
            quantity,
          });
        }

        return tx.order.create({
          data: {
            customerId: details.customerId,
            customerName: details.customerName,
            phone: customer.phone,
            address: details.address,
            city: details.city,
            pincode: details.pincode,
            total,
            paymentMethod: "COD",
            idempotencyKey: details.idempotencyKey,
            items: {
              create: orderItems,
            },
          },
        });
      });

      return {
        orderId: order.id,
        replayed: false,
      };
    });

    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof OrderQueueFullError) {
      return NextResponse.json(
        {
          error: "Server is busy. Please try again shortly.",
        },
        { status: 503 },
      );
    }

    // Recover when a competing process has already
    // committed an order with this checkout key.
    if (checkout && isUniqueConstraintError(error)) {
      try {
        const existing = await findMatchingOrder(checkout);

        if (existing) {
          return NextResponse.json(existing, {
            status: 200,
          });
        }
      } catch (recoveryError) {
        if (recoveryError instanceof IdempotencyConflictError) {
          return NextResponse.json(
            { error: recoveryError.message },
            { status: 409 },
          );
        }

        console.error("Checkout recovery failed:", recoveryError);
      }

      return NextResponse.json(
        {
          error: "Checkout conflict. Please retry with the same checkout key.",
        },
        { status: 409 },
      );
    }

    if (error instanceof StockConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Order creation failed:", error);

    return NextResponse.json(
      {
        error:
          "Could not place order. Please try again with the same checkout key.",
      },
      { status: 500 },
    );
  }
}
