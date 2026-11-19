import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import StatusUpdater from "./StatusUpdater";
export const instant = false;

export default async function AdminOrdersPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="text-indigo-600">
          ← Back to Admin
        </Link>

        <h1 className="mt-6 text-3xl font-bold">Customer Orders</h1>

        <p className="mt-2 text-slate-500">Total Orders: {orders.length}</p>

        <div className="mt-8 space-y-5">
          {orders.length === 0 && <p>No orders received yet.</p>}

          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border bg-white p-5 shadow-sm"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Order #{order.id}</h2>
                  <p className="text-sm text-slate-500">
                    {order.createdAt.toLocaleString("en-IN")}
                  </p>
                </div>

                <span className="font-semibold text-indigo-600">
                  {order.status}
                </span>
                <StatusUpdater
                  orderId={order.id}
                  currentStatus={order.status}
                />
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <b>Customer:</b> {order.customerName}
                </p>
                <p>
                  <b>Phone:</b> {order.phone}
                </p>
                <p>
                  <b>Address:</b> {order.address}, {order.city} -{" "}
                  {order.pincode}
                </p>
                <p>
                  <b>Payment:</b> {order.paymentMethod}
                </p>
              </div>

              <div className="mt-4 border-t pt-4">
                <h3 className="font-bold">Products</h3>

                {order.items.map((item) => (
                  <p key={item.id} className="mt-2 text-sm">
                    {item.productName} × {item.quantity}
                    {" — "}₹
                    {(item.price * item.quantity).toLocaleString("en-IN")}
                  </p>
                ))}
              </div>

              <p className="mt-4 text-lg font-bold">
                Total: ₹{order.total.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
