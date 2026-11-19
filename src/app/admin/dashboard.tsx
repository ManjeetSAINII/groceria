"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

type Form = {
  name: string;
  category: string;
  price: string;
  stock: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
};

const blank: Form = {
  name: "",
  category: "",
  price: "",
  stock: "0",
  description: "",
  imageUrl: "",
  isActive: true,
};

export default function AdminDashboard() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"overview" | "products">("overview");
  const [mobileMenu, setMobileMenu] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/products", { cache: "no-store" });
    if (r.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!r.ok) throw new Error("Unable to load products");
    setProducts(await r.json());
  }

  useEffect(() => {
    load().catch((e) => setError(String(e)));
    // Initial load only; refreshes after mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      products.filter((p) =>
        `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );
  const lowStock = products.filter((p) => p.stock <= 5);
  const active = products.filter((p) => p.isActive).length;
  const inventory = products.reduce((sum, p) => sum + p.stock, 0);

  function field<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        editing === null
          ? "/api/admin/products"
          : `/api/admin/products/${editing}`,
        {
          method: editing === null ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            price: Number(form.price),
            stock: Number(form.stock),
          }),
        },
      );
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
      setForm(blank);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function edit(p: Product) {
    setEditing(p.id);
    setForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      stock: String(p.stock),
      description: p.description ?? "",
      imageUrl: p.imageUrl ?? "",
      isActive: p.isActive,
    });
    setTab("products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: number) {
    if (!confirm("Delete this product permanently?")) return;
    setError("");
    try {
      const r = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function logout() {
    try {
      const r = await fetch("/api/admin/logout", { method: "POST" });
      if (!r.ok) throw new Error("Logout failed");
      router.replace("/admin/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logout failed");
    }
  }

  async function uploadImage(file: File) {
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      field("imageUrl", result.imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#F66542] focus:ring-2 focus:ring-orange-100";
  const nav = (label: string, selected: boolean) =>
    `block w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${selected ? "bg-[#315B4A] text-white" : "text-[#D9E6DF] hover:bg-[#315B4A]"}`;

  return (
    <div className="min-h-screen bg-[#F5F7F5] text-slate-900 lg:flex">
      <aside
        className={`${mobileMenu ? "block" : "hidden"} bg-[#19352C] px-5 py-7 text-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0`}
      >
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-2xl font-black tracking-tight">
              groceria<span className="text-[#F66542]">.</span>
            </p>
            <p className="mt-1 text-xs text-[#A8C4B7]">ADMIN CONSOLE</p>
          </div>
          <button
            className="lg:hidden"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="space-y-2" aria-label="Admin navigation">
          <button
            className={nav("Overview", tab === "overview")}
            onClick={() => {
              setTab("overview");
              setMobileMenu(false);
            }}
          >
            ▦ &nbsp; Overview
          </button>
          <button
            className={nav("Products", tab === "products")}
            onClick={() => {
              setTab("products");
              setMobileMenu(false);
            }}
          >
            ▣ &nbsp; Products
          </button>
          <a className={nav("Orders", false)} href="/admin/orders">
            ▤ &nbsp; Orders
          </a>
          <a className={nav("Storefront", false)} href="/">
            ↗ &nbsp; View Store
          </a>
        </nav>
        <div className="mt-10 border-t border-white/20 pt-5">
          <button
            onClick={logout}
            className="w-full rounded-xl border border-white/30 px-4 py-3 text-left text-sm font-semibold hover:bg-white/10"
          >
            ↪ &nbsp; Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(true)}
              className="rounded-xl border bg-white px-3 py-2 lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
            <div>
              <p className="text-sm font-semibold text-[#F66542]">
                Groceria Admin
              </p>
              <h1 className="text-3xl font-black tracking-tight">
                {tab === "overview" ? "Overview" : "Product Management"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your grocery store in one place.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setTab("products");
              setEditing(null);
              setForm(blank);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="rounded-xl bg-[#F66542] px-5 py-3 font-bold text-white hover:bg-[#E65431]"
          >
            + Add Product
          </button>
        </header>

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {tab === "overview" && (
          <div className="space-y-7">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total Products", value: products.length, icon: "▣" },
                { label: "Active Products", value: active, icon: "✓" },
                { label: "Low Stock (≤5)", value: lowStock.length, icon: "!" },
                { label: "Units in Stock", value: inventory, icon: "▤" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0DE] text-lg font-black text-[#F66542]">
                    {stat.icon}
                  </div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-3xl font-black">
                    {stat.value.toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
            <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Inventory Attention</h2>
                <button
                  onClick={() => setTab("products")}
                  className="text-sm font-bold text-[#F66542]"
                >
                  Manage products →
                </button>
              </div>
              {lowStock.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No products with 5 or fewer units in stock.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {lowStock.slice(0, 8).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.category}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-orange-700">
                          {p.stock} left
                        </span>
                        <button
                          onClick={() => edit(p)}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => setTab("products")}
                className="rounded-2xl border bg-white p-6 text-left shadow-sm hover:border-[#F66542]"
              >
                <p className="text-lg font-bold">▣ Manage Products</p>
                <p className="mt-2 text-sm text-slate-500">
                  Add products, update prices, and manage stock.
                </p>
              </button>
              <a
                href="/admin/orders"
                className="rounded-2xl border bg-white p-6 shadow-sm hover:border-[#F66542]"
              >
                <p className="text-lg font-bold">▤ View Orders</p>
                <p className="mt-2 text-sm text-slate-500">
                  Review customer orders and update delivery status.
                </p>
              </a>
            </div>
          </div>
        )}

        {tab === "products" && (
          <div className="space-y-7">
            <form
              onSubmit={save}
              className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-7"
            >
              <div className="sm:col-span-2">
                <h2 className="text-xl font-bold">
                  {editing === null
                    ? "Add New Product"
                    : `Edit Product #${editing}`}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Fill in the details below to update your storefront.
                </p>
              </div>
              <label className="text-sm font-semibold">
                Product Name
                <input
                  required
                  maxLength={150}
                  className={input}
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </label>
              <label className="text-sm font-semibold">
                Category
                <input
                  required
                  maxLength={100}
                  className={input}
                  value={form.category}
                  onChange={(e) => field("category", e.target.value)}
                />
              </label>
              <label className="text-sm font-semibold">
                Price (₹, whole rupees)
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  className={input}
                  value={form.price}
                  onChange={(e) => field("price", e.target.value)}
                />
              </label>
              <label className="text-sm font-semibold">
                Stock Quantity
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  className={input}
                  value={form.stock}
                  onChange={(e) => field("stock", e.target.value)}
                />
              </label>
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold">
                  Upload Product Image
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  className={input}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await uploadImage(file);
                    e.target.value = "";
                  }}
                />
                <p className="mt-1 text-xs text-slate-500">
                  JPG, PNG or WebP (maximum 5 MB)
                </p>
              </div>
              <label className="text-sm font-semibold sm:col-span-2">
                Image URL (optional)
                <input
                  type="text"
                  placeholder="https://example.com/product.jpg"
                  className={input}
                  value={form.imageUrl}
                  onChange={(e) => field("imageUrl", e.target.value)}
                />
              </label>
              {form.imageUrl && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-semibold">Image Preview</p>
                  <img
                    src={form.imageUrl}
                    alt="Product preview"
                    className="h-40 w-40 rounded-xl border object-cover"
                  />
                </div>
              )}
              <label className="text-sm font-semibold sm:col-span-2">
                Description
                <textarea
                  className={input}
                  rows={3}
                  value={form.description}
                  onChange={(e) => field("description", e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => field("isActive", e.target.checked)}
                />{" "}
                Visible on storefront
              </label>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button
                  disabled={busy}
                  className="rounded-xl bg-[#F66542] px-6 py-3 font-bold text-white disabled:opacity-50"
                >
                  {busy
                    ? "Saving..."
                    : editing === null
                      ? "Add Product"
                      : "Save Changes"}
                </button>
                {editing !== null && (
                  <button
                    type="button"
                    className="rounded-xl border px-5 py-3 font-semibold"
                    onClick={() => {
                      setEditing(null);
                      setForm(blank);
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold">
                  Products ({products.length})
                </h2>
                <input
                  aria-label="Search products"
                  placeholder="Search products or categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-[#F66542] sm:w-72"
                />
              </div>
              <div className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-14 w-14 shrink-0 rounded-xl border object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#FFF0DE] text-2xl">
                          🛒
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold">{p.name}</p>
                        <p className="text-sm text-slate-500">
                          {p.category} · ₹{p.price.toLocaleString("en-IN")} ·
                          Stock {p.stock}
                        </p>
                        <p
                          className={`text-xs font-semibold ${p.isActive ? "text-green-700" : "text-slate-500"}`}
                        >
                          {p.isActive ? "Visible" : "Hidden"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => edit(p)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    {products.length === 0
                      ? "No products yet. Add your first product above."
                      : "No matching products found."}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
