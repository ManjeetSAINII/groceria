"use client";

import { useEffect, useState } from "react";

type Customer = { id: number; name: string | null; phone: string };

export default function CustomerLogin() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/customer/me", { cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : { customer: null }))
      .then((data) => {
        if (active) setCustomer(data.customer ?? null);
      })
      .catch(() => {
        if (active) setCustomer(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter a 6-digit OTP.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      setCustomer(data.customer);
      setOpen(false);
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/customer/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      setCustomer(null);
      setOpen(false);
      setPhone("");
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {customer ? (
        <a
          href="/account"
          className="whitespace-nowrap rounded-full bg-[#FFF0DE] px-3 py-2.5 text-xs font-bold text-[#30332D] hover:bg-[#FFE1BD] sm:px-4"
        >
          👤 My Account
        </a>
      ) : (
        <button
          type="button"
          disabled={checking}
          onClick={() => {
            setError("");
            setOpen(true);
          }}
          className="whitespace-nowrap rounded-full bg-[#FFF0DE] px-3 py-2.5 text-xs font-bold text-[#30332D] hover:bg-[#FFE1BD] disabled:opacity-50 sm:px-4"
        >
          {checking ? "Account" : "👤 Login"}
        </button>
      )}
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={customer ? "My Account" : "Customer Login"}
            className="w-full max-w-sm rounded-[28px] bg-[#FFF9F0] p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-[#30332D]">
                  🧺 groceria<span className="text-[#F66542]">.</span>
                </h2>
                <p className="mt-1 text-sm text-[#817B73]">
                  {customer ? "My Account" : "Login / Sign Up"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close login"
                className="rounded-full bg-white px-3 py-2"
              >
                ✕
              </button>
            </div>
            {customer ? (
              <div className="space-y-4">
                <p className="rounded-xl bg-white p-4 text-sm">
                  Signed in as <strong>{customer.phone}</strong>
                </p>
                <a
                  href="/track-order"
                  className="block rounded-full bg-white px-5 py-3 text-center font-bold"
                >
                  📦 Track Order
                </a>
                <a
                  href="/account"
                  className="block rounded-full bg-white px-5 py-3 text-center font-bold hover:bg-[#FFE1BD]"
                >
                  👤 View My Account & Orders
                </a>
                {error && (
                  <p role="alert" className="text-sm text-red-600">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={logout}
                  disabled={loading}
                  className="w-full rounded-full bg-[#F66542] px-5 py-3 font-bold text-white disabled:opacity-50"
                >
                  {loading ? "Logging out..." : "Logout"}
                </button>
              </div>
            ) : (
              <form onSubmit={login} className="space-y-4">
                <div>
                  <label
                    htmlFor="customer-phone"
                    className="mb-1 block text-sm font-bold"
                  >
                    Mobile Number
                  </label>
                  <input
                    id="customer-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="10-digit mobile number"
                    className="w-full rounded-xl border border-[#E9DCCB] bg-white p-3 outline-[#F66542]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="customer-otp"
                    className="mb-1 block text-sm font-bold"
                  >
                    OTP
                  </label>
                  <input
                    id="customer-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full rounded-xl border border-[#E9DCCB] bg-white p-3 outline-[#F66542]"
                  />
                </div>
                <p className="text-xs text-[#817B73]">
                  Local testing only: use OTP 123456. No SMS is sent.
                </p>
                {error && (
                  <p role="alert" className="text-sm text-red-600">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-[#F66542] px-5 py-3 font-bold text-white disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify & Login"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
