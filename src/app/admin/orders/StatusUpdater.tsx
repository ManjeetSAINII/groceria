"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StatusUpdater({
  orderId,
  currentStatus,
}: {
  orderId: number;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      router.refresh();
    } catch {
      setError("Could not update status. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-lg border bg-white px-3 py-2"
      >
        <option value="PENDING">Pending</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="SHIPPED">Shipped</option>
        <option value="OUT_FOR_DELIVERY">Out for Delivery</option>

        <option value="DELIVERED">Delivered</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      <button
        onClick={updateStatus}
        disabled={loading || status === currentStatus}
        className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Updating..." : "Update Status"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
