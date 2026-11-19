import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { prisma } from "@/lib/prisma";
import { getLoggedInCustomer } from "@/lib/customer-session";
type CartItem = {
  productId: number;
  quantity: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customer = await getLoggedInCustomer();

    if (!customer) {
      return NextResponse.json(
        { error: "Please log in before making a payment" },
        { status: 401 },
      );
    }

    const { customerName, address, city, pincode, items } = body;
    const phone = customer.phone;
    // Validate delivery details
    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      typeof phone !== "string" ||
      !/^[6-9]\d{9}$/.test(phone) ||
      typeof address !== "string" ||
      !address.trim() ||
      typeof city !== "string" ||
      !city.trim() ||
      typeof pincode !== "string" ||
      !/^\d{6}$/.test(pincode) ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50
    ) {
      return NextResponse.json(
        { error: "Invalid delivery details or cart" },
        { status: 400 },
      );
    }

    // Combine quantities for duplicate product IDs
    const quantities = new Map<number, number>();

    for (const item of items as CartItem[]) {
      if (
        !item ||
        !Number.isSafeInteger(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.productId <= 0 ||
        item.quantity <= 0 ||
        item.quantity > 100
      ) {
        return NextResponse.json(
          { error: "Invalid cart items" },
          { status: 400 },
        );
      }

      const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;

      if (!Number.isSafeInteger(quantity) || quantity > 100) {
        return NextResponse.json(
          { error: "Invalid total product quantity" },
          { status: 400 },
        );
      }

      quantities.set(item.productId, quantity);
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: [...quantities.keys()] },
        isActive: true,
      },
    });

    if (products.length !== quantities.size) {
      return NextResponse.json(
        { error: "Some products are unavailable" },
        { status: 400 },
      );
    }

    let total = 0;

    const orderItems = products.map((product) => {
      const quantity = quantities.get(product.id)!;

      if (product.stock < quantity) {
        throw new Error(`Not enough stock for ${product.name}`);
      }

      total += product.price * quantity;

      return {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity,
      };
    });

    // Product prices are stored in rupees.
    // Razorpay expects paise.
    if (!Number.isSafeInteger(total) || total <= 0 || total > 50000000) {
      return NextResponse.json(
        { error: "Invalid order total" },
        { status: 400 },
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay is not configured" },
        { status: 500 },
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: total * 100,
      currency: "INR",
      receipt: `cart_${Date.now()}`,
    });

    // Save the exact checkout details used to create
    // this Razorpay payment order.
    await prisma.pendingPayment.create({
      data: {
        customerId: customer.id,
        razorpayOrderId: razorpayOrder.id,
        amount: total * 100,
        currency: "INR",
        customerName: customerName.trim(),
        phone,
        address: address.trim(),
        city: city.trim(),
        pincode,
        itemsJson: JSON.stringify(orderItems),
        status: "PENDING",
      },
    });

    return NextResponse.json({
      razorpayOrderId: razorpayOrder.id,
      amount: total * 100,
      currency: "INR",
      keyId,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.startsWith("Not enough stock")
            ? error.message
            : "Unable to create payment order",
      },
      { status: 400 },
    );
  }
}
