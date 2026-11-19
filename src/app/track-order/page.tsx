"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type TrackingResult = {
  id: number;
  status: string;
  createdAt: string;
};

type CustomerOrder = TrackingResult & {
  total?: number;
  paymentMethod?: string;
  paymentStatus?: string;
};

const steps = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const requestedOrderId = searchParams.get("orderId");

  const [checkingLogin, setCheckingLogin] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackingResult | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCustomerOrders() {
      try {
        const meResponse = await fetch("/api/customer/me", {
          cache: "no-store",
        });

        if (meResponse.status === 401) {
          setLoggedIn(false);
          setError("");
          return;
        }

        if (!meResponse.ok) {
          throw new Error("Unable to check login");
        }
        const meData = await meResponse.json();

        if (!active) return;

        if (!meData.customer) {
          setLoggedIn(false);
          return;
        }

        setLoggedIn(true);

        const ordersResponse = await fetch("/api/customer/orders", {
          cache: "no-store",
        });

        if (!ordersResponse.ok) {
          throw new Error("Unable to load your orders");
        }

        const ordersData = await ordersResponse.json();

        if (!active) return;

        const customerOrders: CustomerOrder[] = Array.isArray(ordersData)
          ? ordersData
          : (ordersData.orders ?? []);

        setOrders(customerOrders);

        if (customerOrders.length > 0) {
          const selected = requestedOrderId
            ? customerOrders.find(
                (item) => String(item.id) === requestedOrderId,
              )
            : customerOrders[0];

          if (selected) {
            setOrder(selected);
          } else {
            setError("This order was not found in your account.");
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load orders",
          );
        }
      } finally {
        if (active) setCheckingLogin(false);
      }
    }

    loadCustomerOrders();

    return () => {
      active = false;
    };
  }, [requestedOrderId]);

  async function trackOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const response = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to track order");
      }

      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-3xl font-black text-[#30332D]">
        📦 Track Your Order
      </h1>

      <p className="mb-6 text-sm text-gray-600">
        Track your Groceria order and delivery progress.
      </p>

      {checkingLogin ? (
        <p className="rounded-xl bg-white p-5">Loading your orders...</p>
      ) : loggedIn ? (
        <section className="mb-6 rounded-2xl border bg-white p-5">
          <h2 className="mb-4 text-xl font-bold">
            My Orders ({orders.length})
          </h2>

          {orders.length === 0 ? (
            <div className="space-y-3">
              <p>You have no orders linked to your account yet.</p>
              <a
                href="/"
                className="inline-block rounded-full bg-[#F66542] px-5 py-3 font-bold text-white"
              >
                Start Shopping
              </a>
            </div>
          ) : (
            <div className="grid gap-3">
              {orders.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOrder(item);
                    setError("");
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    order?.id === item.id
                      ? "border-[#F66542] bg-[#FFF0DE]"
                      : "border-gray-200 bg-white hover:bg-orange-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong>Order #{item.id}</strong>
                    <span className="text-sm font-semibold">{item.status}</span>
                  </div>

                  <p className="mt-2 text-sm text-gray-600">
                    Placed on{" "}
                    {new Date(item.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <form
          onSubmit={trackOrder}
          className="space-y-4 rounded-2xl border bg-white p-5"
        >
          <p className="font-semibold">
            Enter your order details to track delivery.
          </p>

          <label className="block">
            Order Number
            <input
              type="number"
              min="1"
              required
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="mt-1 w-full rounded border p-3 text-black"
              placeholder="Enter order number"
            />
          </label>

          <label className="block">
            Phone Number
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded border p-3 text-black"
              placeholder="Enter registered phone number"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#F66542] p-3 font-bold text-white disabled:opacity-50"
          >
            {loading ? "Checking..." : "Track Order"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}

      {order && (
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Order #{order.id}</h2>

          <p className="mt-2">
            Status: <strong>{order.status}</strong>
          </p>

          <p className="mt-2">
            Placed on: {new Date(order.createdAt).toLocaleDateString("en-IN")}
          </p>

          {order.status === "CANCELLED" ? (
            <p className="mt-5 rounded-lg bg-red-100 p-4 text-red-700">
              This order has been cancelled.
            </p>
          ) : (
            <div className="mt-6">
              <h3 className="mb-4 font-semibold">Order Progress</h3>

              <div className="grid grid-cols-5 gap-2">
                {steps.map((status, index) => {
                  const currentIndex = steps.indexOf(order.status);
                  const completed = currentIndex >= index;

                  return (
                    <div key={status} className="text-center">
                      <div
                        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
                          completed
                            ? "bg-green-600 text-white"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {completed ? "✓" : index + 1}
                      </div>

                      <p className="mt-2 text-xs font-medium">
                        {status === "PENDING"
                          ? "Placed"
                          : status === "OUT_FOR_DELIVERY"
                            ? "Out for Delivery"
                            : status.charAt(0) + status.slice(1).toLowerCase()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading tracking...</p>}>
      <TrackOrderContent />
    </Suspense>
  );
}
