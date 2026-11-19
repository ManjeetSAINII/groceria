"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const router = useRouter();

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Login failed (HTTP ${response.status})`);
      }

      setPassword("");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F6F2] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <a
            href="/"
            className="inline-block text-4xl font-black tracking-tight text-[#19352C]"
          >
            🧺 groceria<span className="text-[#F66542]">.</span>
          </a>

          <p className="mt-2 text-sm font-medium text-[#7C8A82]">
            Store Management Portal
          </p>
        </div>

        <div className="rounded-[28px] border border-[#E1E9E2] bg-white p-7 shadow-xl shadow-[#19352C]/5 sm:p-9">
          <div className="mb-7">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF4ED] text-2xl">
              🔐
            </div>

            <h1 className="text-2xl font-black text-[#19352C]">
              Admin Sign In
            </h1>

            <p className="mt-2 text-sm text-[#7C8A82]">
              Enter your administrator password to manage your store.
            </p>
          </div>

          <form onSubmit={login} className="space-y-5">
            <div>
              <label
                htmlFor="admin-password"
                className="mb-2 block text-sm font-bold text-[#19352C]"
              >
                Admin Password
              </label>

              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your admin password"
                  required
                  disabled={busy}
                  className="w-full rounded-xl border border-[#DCE5DC] bg-[#FAFCFA] px-4 py-3.5 pr-16 text-[#19352C] outline-none transition focus:border-[#F66542] focus:ring-2 focus:ring-[#F66542]/15"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 text-xs font-bold text-[#66786C] hover:text-[#F66542]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center rounded-xl bg-[#19352C] px-5 py-3.5 font-bold text-white transition hover:bg-[#285341] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Signing in..." : "Sign In to Dashboard →"}
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#7C8A82]">
          <span>🔒</span>
          <span>Restricted to authorized administrators</span>
        </div>

        <p className="mt-4 text-center text-xs text-[#9AA69E]">
          © {new Date().getFullYear()} Groceria. All rights reserved.
        </p>
      </div>
    </main>
  );
}
