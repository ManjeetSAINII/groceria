"use client";

import { useEffect, useMemo, useState } from "react";
import CustomerLogin from "./components/CustomerLogin";

type RazorpayPaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void;
  prefill?: {
    name?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };

  modal?: {
    ondismiss?: () => void;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
    };
  }
}

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  stock: number;
  isActive: boolean;
};

type Cart = Record<number, number>;

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load products");
        }

        const data: Product[] = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Product loading failed:", error);
      }
    }

    loadProducts();
  }, []);

  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(4);
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Cart>({});
  const [showCart, setShowCart] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [successfulOrderId, setSuccessfulOrderId] = useState<number | null>(
    null,
  );

  const [showCheckout, setShowCheckout] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"COD" | "ONLINE">("COD");

  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const [customer, setCustomer] = useState({
    customerName: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
  });

  const categories = ["All", ...new Set(products.map((p) => p.category))];
  useEffect(() => {
    setVisibleCount(4);
  }, [search, category]);

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "All" || p.category === category) &&
          p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search, category],
  );
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const total = products.reduce(
    (sum, p) => sum + p.price * (cart[p.id] || 0),
    0,
  );
  function add(id: number) {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    setCart((current) => {
      const quantity = current[id] || 0;

      if (quantity >= product.stock) {
        alert(`Only ${product.stock} items available in stock`);
        return current;
      }

      return { ...current, [id]: quantity + 1 };
    });
  }
  function remove(id: number) {
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] || 0) - 1),
    }));
  }

  async function placeOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (placingOrder) return;

    setPlacingOrder(true);
    setCheckoutError("");

    try {
      const items = products
        .filter((p) => (cart[p.id] || 0) > 0)
        .map((p) => ({
          productId: p.id,
          quantity: cart[p.id],
        }));

      if (items.length === 0) {
        throw new Error("Your cart is empty");
      }

      // Shared success handling for COD and online payments
      async function completeOrder(orderId: number) {
        sessionStorage.removeItem("groceria_pending_cod");
        setCart({});
        setShowCheckout(false);
        setShowCart(false);
        setSuccessfulOrderId(orderId);

        try {
          const productsResponse = await fetch("/api/products", {
            cache: "no-store",
          });

          if (productsResponse.ok) {
            setProducts(await productsResponse.json());
          }
        } catch (error) {
          console.error("Could not refresh products:", error);
        }
      }

      // CASH ON DELIVERY
      if (paymentMethod === "COD") {
        const checkoutPayload = JSON.stringify({
          ...customer,
          items,
        });

        const storedCheckout = sessionStorage.getItem("groceria_pending_cod");

        let checkoutKey = crypto.randomUUID();

        if (storedCheckout) {
          try {
            const previous = JSON.parse(storedCheckout);

            if (
              previous.payload === checkoutPayload &&
              typeof previous.key === "string"
            ) {
              checkoutKey = previous.key;
            }
          } catch {
            // Invalid saved checkout: start a new one.
          }
        }

        sessionStorage.setItem(
          "groceria_pending_cod",
          JSON.stringify({
            payload: checkoutPayload,
            key: checkoutKey,
          }),
        );

        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...customer,
            items,
            idempotencyKey: checkoutKey,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Order failed");
        }

        await completeOrder(data.orderId);
        return;
      }

      // ONLINE PAYMENT
      if (!window.Razorpay) {
        throw new Error("Payment gateway is still loading. Please try again.");
      }

      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...customer, items }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to start payment");
      }

      const razorpay = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "My Store",
        description: "Online Store Purchase",
        order_id: data.razorpayOrderId,
        prefill: {
          name: customer.customerName,
          contact: customer.phone,
        },
        theme: {
          color: "#F66542",
        },

        modal: {
          ondismiss: () => {
            setPlacingOrder(false);
            setCheckoutError("Payment window closed. You can try again.");
          },
        },

        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paymentResponse),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.verified) {
              throw new Error(
                verifyData.error || "Payment verification failed",
              );
            }

            await completeOrder(verifyData.orderId);
          } catch (error) {
            setCheckoutError(
              error instanceof Error
                ? error.message
                : "Payment verification failed. Contact support if money was deducted.",
            );
          } finally {
            setPlacingOrder(false);
          }
        },
      });

      razorpay.open();
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      if (paymentMethod === "COD") {
        setPlacingOrder(false);
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#DC9B50] px-3 py-5 text-[#30332D] sm:px-6 sm:py-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[30px] bg-white p-2 shadow-[0_20px_65px_rgba(87,52,18,0.12)] sm:rounded-[36px] sm:p-3">
        <header className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-7 lg:gap-8 lg:px-10">
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            aria-label="Open navigation menu"
            aria-expanded={showMenu}
            aria-controls="store-navigation-menu"
            className="rounded-lg px-2 py-1 text-xl font-bold transition hover:bg-[#FFF0DE]"
          >
            ☰
          </button>
          <a
            href="/"
            className="whitespace-nowrap text-xl font-black tracking-tight"
          >
            🧺 groceria<span className="text-[#F66542]">.</span>
          </a>
          <div className="order-3 flex w-full items-center rounded-full bg-[#F6F6F6] px-5 py-3 sm:order-none sm:mx-auto sm:max-w-md sm:flex-1">
            <input
              aria-label="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for grocery, vegetables, spices..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
            <span aria-hidden="true">⌕</span>
          </div>
          {/* <a
            href="/track-order"
            className="ml-auto whitespace-nowrap text-xs font-bold hover:text-[#F66542] sm:ml-0"
          >
            📦 Track
          </a> */}
          <CustomerLogin />
          <button
            type="button"
            onClick={() => setShowCart(true)}
            aria-label={`Open cart with ${count} items`}
            className="relative rounded-full bg-[#F66542] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#E95736]"
          >
            🛒 <span>{count}</span>
          </button>
        </header>
        <div
          className="relative overflow-hidden rounded-[24px] bg-[#FFE1BD] px-5 pb-8 pt-10 sm:px-10 lg:px-14 lg:pt-14"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 18%, rgba(255,255,255,.27) 0 16px, transparent 17px)",
            backgroundSize: "44px 44px",
          }}
        >
          <div className="relative z-10 flex min-h-[250px] flex-col justify-center gap-4 sm:min-h-[280px] sm:w-[57%] lg:min-h-[300px]">
            <span className="w-fit rounded-full bg-white/65 px-4 py-2 text-xs font-bold text-[#B96C32]">
              🌱 Fresh picks, happy kitchens
            </span>
            <h1 className="max-w-[430px] text-4xl font-black leading-[1.07] tracking-tight sm:text-5xl lg:text-[58px]">
              From farm to
              <br />
              your kitchen
            </h1>
            <p className="max-w-[320px] text-sm leading-relaxed text-[#777066] sm:text-base">
              Discover the freshest and finest groceries delivered quickly and
              conveniently.
            </p>
            <a
              href="#products"
              className="mt-3 flex w-fit items-center gap-8 rounded-full bg-[#F66542] py-3 pl-7 pr-2 text-sm font-bold text-white shadow-[0_10px_20px_rgba(246,101,66,.2)] transition hover:-translate-y-0.5 hover:bg-[#E95736]"
            >
              Shop Now{" "}
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#30332D]">
                🛍
              </span>
            </a>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-[-10px] top-12 hidden h-[270px] w-[45%] items-center justify-center sm:flex lg:right-5 lg:top-10 lg:h-[300px]"
          >
            <div className="relative text-center text-[120px] drop-shadow-xl lg:text-[160px]">
              🛍️
              <span className="absolute -left-8 -top-2 text-[55px] lg:text-[70px]">
                🥬
              </span>
              <span className="absolute right-0 -top-8 text-[50px] lg:text-[65px]">
                🥦
              </span>
              <span className="absolute left-10 -top-12 text-[45px] lg:text-[55px]">
                🥕
              </span>
              <span className="absolute bottom-7 -right-8 text-[40px] lg:text-[50px]">
                🫑
              </span>
            </div>
            <span className="absolute right-0 top-16 rounded-full bg-white px-4 py-3 text-xs font-black text-[#F66542] shadow-sm">
              51% OFF!{" "}
              <span className="block text-[10px] font-normal text-[#30332D]">
                Fresh deals every day
              </span>
            </span>
          </div>
          <section id="products" className="relative z-10 mt-10 scroll-mt-24">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[#A66D43]">
                  Handpicked for you
                </p>
                <h2 className="text-2xl font-black">Fresh groceries</h2>
              </div>
              <span className="rounded-full bg-white/65 px-4 py-2 text-xs font-semibold">
                {visible.length} products
              </span>
            </div>
            <div className="mb-5 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${category === c ? "bg-[#F66542] text-white" : "bg-white/75 text-[#5E554A] hover:bg-white"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visible.slice(0, visibleCount).map((p, i) => (
                <article
                  key={p.id}
                  className="overflow-hidden rounded-[26px] bg-white p-2 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    className={`relative flex h-44 items-center justify-center overflow-hidden rounded-[22px] ${["bg-[#FFD7A8]", "bg-[#FFD6D1]", "bg-[#EDFFC1]", "bg-[#FBE0F1]"][i % 4]}`}
                  >
                    <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[10px] font-black">
                      {p.stock > 0 ? "Fresh pick" : "Sold out"}
                    </span>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-contain p-3"
                      />
                    ) : (
                      <span className="text-7xl">
                        {["🥕", "🫑", "🥬", "🥦", "🍅", "🍎"][i % 6]}
                      </span>
                    )}
                  </div>
                  <div className="px-3 pb-3 pt-4 text-center">
                    <p className="truncate text-[11px] text-[#817B73]">
                      {p.category || "Fresh grocery"}
                    </p>
                    <h3 className="mt-1 truncate text-base font-extrabold">
                      {p.name}
                    </h3>
                    <p className="mt-1 min-h-[32px] line-clamp-2 text-xs text-[#817B73]">
                      {p.description ||
                        (p.stock > 0
                          ? `${p.stock} available in stock`
                          : "Currently unavailable")}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2 px-1">
                      <span className="text-lg font-black">
                        ₹{p.price.toLocaleString("en-IN")}
                      </span>
                      <button
                        type="button"
                        onClick={() => add(p.id)}
                        disabled={p.stock <= 0}
                        aria-label={`Add ${p.name} to cart`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#30332D] text-xl font-bold transition hover:bg-[#F66542] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {visible.length > visibleCount && (
              <div className="mt-9 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + 4)}
                  className="rounded-full bg-[#F66542] px-10 py-3.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#E95736] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F66542]"
                >
                  Load More ↓
                </button>
              </div>
            )}
            {visible.length === 0 && (
              <p className="rounded-2xl bg-white/75 px-5 py-12 text-center text-sm text-[#817B73]">
                No products found. Try another search or category.
              </p>
            )}
          </section>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 px-6 py-5 text-xs text-[#817B73] sm:px-10">
          <span>© 2026 groceria. Fresh groceries, happy homes.</span>
          <a href="/track-order" className="font-bold text-[#F66542]">
            Track your order →
          </a>
        </footer>
      </div>
      {showMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setShowMenu(false)}
        >
          <aside
            id="store-navigation-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Store navigation"
            onClick={(e) => e.stopPropagation()}
            className="h-full w-[min(85vw,340px)] overflow-y-auto rounded-r-[28px] bg-[#FFF9F0] p-6 shadow-2xl"
          >
            <div className="mb-8 flex items-center justify-between">
              <span className="text-xl font-black">
                🧺 groceria<span className="text-[#F66542]">.</span>
              </span>
              <button
                type="button"
                onClick={() => setShowMenu(false)}
                aria-label="Close navigation menu"
                className="rounded-full bg-white px-3 py-2 text-xl"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-3 text-sm font-bold">
              <a
                href="/"
                onClick={() => setShowMenu(false)}
                className="rounded-2xl bg-white px-5 py-4 hover:bg-[#FFE1BD]"
              >
                🏠 Home
              </a>
              <a
                href="#products"
                onClick={() => {
                  setShowMenu(false);
                  setCategory("All");
                }}
                className="rounded-2xl bg-white px-5 py-4 hover:bg-[#FFE1BD]"
              >
                🛍️ Shop Products
              </a>

              <a
                href="/track-order"
                onClick={() => setShowMenu(false)}
                className="rounded-2xl bg-white px-5 py-4 hover:bg-[#FFE1BD]"
              >
                📦 Track Order
              </a>
              <a
                href="/admin"
                onClick={() => setShowMenu(false)}
                className="rounded-2xl bg-white px-5 py-4 hover:bg-[#FFE1BD]"
              >
                🔐 Admin Panel
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowCart(true);
                }}
                className="rounded-2xl bg-[#F66542] px-5 py-4 text-left text-white hover:bg-[#E95736]"
              >
                🛒 My Cart ({count})
              </button>
            </nav>
          </aside>
        </div>
      )}
      {showCart && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setShowCart(false)}
        >
          <aside
            aria-label="Shopping cart"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto h-full w-full max-w-md overflow-y-auto bg-[#FFF9F0] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">🛒 Your cart</h2>
              <button
                type="button"
                onClick={() => setShowCart(false)}
                aria-label="Close cart"
                className="rounded-full bg-white px-3 py-2"
              >
                ✕
              </button>
            </div>
            {count === 0 ? (
              <p className="mt-10 text-[#817B73]">Your cart is empty.</p>
            ) : (
              <>
                <div className="mt-8 space-y-3">
                  {products
                    .filter((p) => cart[p.id] > 0)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-2xl bg-white p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">{p.name}</p>
                          <p className="text-xs text-[#817B73]">
                            ₹{p.price.toLocaleString("en-IN")} each
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => remove(p.id)}
                            className="rounded-full bg-[#FFF0DE] px-3 py-1"
                          >
                            −
                          </button>
                          <span className="font-bold">{cart[p.id]}</span>
                          <button
                            type="button"
                            onClick={() => add(p.id)}
                            className="rounded-full bg-[#FFF0DE] px-3 py-1"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="mt-7 flex justify-between border-t border-[#E9DCCB] pt-5 text-xl font-black">
                  <span>Total</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
                {!showCheckout ? (
                  <button
                    type="button"
                    onClick={() => setShowCheckout(true)}
                    className="mt-6 w-full rounded-full bg-[#F66542] px-5 py-4 font-bold text-white hover:bg-[#E95736]"
                  >
                    Proceed to Checkout →
                  </button>
                ) : (
                  <form onSubmit={placeOrder} className="mt-6 space-y-4">
                    <h3 className="text-xl font-black">Delivery details</h3>
                    {(
                      [
                        ["customerName", "Full Name"],
                        ["phone", "Mobile Number"],
                        ["address", "Delivery Address"],
                        ["city", "City"],
                        ["pincode", "PIN Code"],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <label className="mb-1 block text-sm font-semibold">
                          {label}
                        </label>
                        <input
                          required
                          value={customer[field]}
                          onChange={(e) =>
                            setCustomer({
                              ...customer,
                              [field]: e.target.value,
                            })
                          }
                          maxLength={
                            field === "phone"
                              ? 10
                              : field === "pincode"
                                ? 6
                                : 200
                          }
                          inputMode={
                            field === "phone" || field === "pincode"
                              ? "numeric"
                              : "text"
                          }
                          className="w-full rounded-xl border border-[#E9DCCB] bg-white p-3 outline-[#F66542]"
                        />
                      </div>
                    ))}
                    <p className="font-bold">Select payment method</p>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-4">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="COD"
                        checked={paymentMethod === "COD"}
                        onChange={() => setPaymentMethod("COD")}
                      />
                      <span>💵 Cash on Delivery</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-4">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="ONLINE"
                        checked={paymentMethod === "ONLINE"}
                        onChange={() => setPaymentMethod("ONLINE")}
                      />
                      <span>💳 Pay Online (UPI / Cards)</span>
                    </label>
                    {checkoutError && (
                      <p role="alert" className="text-sm text-red-600">
                        {checkoutError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={placingOrder}
                      className="w-full rounded-full bg-[#F66542] px-5 py-4 font-bold text-white disabled:opacity-50"
                    >
                      {placingOrder
                        ? "Processing..."
                        : paymentMethod === "ONLINE"
                          ? `Pay Online - ₹${total.toLocaleString("en-IN")}`
                          : `Place Order - ₹${total.toLocaleString("en-IN")}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCheckout(false)}
                      className="w-full rounded-full border border-[#E9DCCB] bg-white px-5 py-3 font-bold"
                    >
                      Back to Cart
                    </button>
                  </form>
                )}
              </>
            )}
          </aside>
        </div>
      )}
      {successfulOrderId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-success-title"
            className="w-full max-w-md rounded-[28px] bg-white p-7 text-center shadow-2xl"
          >
            <div className="mb-4 text-5xl">🎉</div>
            <h2 id="order-success-title" className="text-2xl font-black">
              Order Placed Successfully!
            </h2>
            <p className="mt-2 text-sm text-[#817B73]">
              Thank you for shopping with us.
            </p>
            <div className="mt-5 rounded-2xl bg-[#FFF0DE] p-5">
              <p className="text-xs font-bold text-[#817B73]">
                YOUR ORDER NUMBER
              </p>
              <p className="mt-1 text-3xl font-black">#{successfulOrderId}</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      String(successfulOrderId),
                    );
                    alert("Order number copied!");
                  } catch {
                    alert("Could not copy. Please copy the number manually.");
                  }
                }}
                className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-bold"
              >
                📋 Copy Order Number
              </button>
            </div>
            <p className="mt-4 text-sm text-[#817B73]">
              Save your order number and use your checkout phone number to track
              delivery.
            </p>
            <a
              href="/track-order"
              className="mt-5 block rounded-full bg-[#F66542] px-5 py-3 font-bold text-white"
            >
              📦 Track Your Order
            </a>
            <button
              type="button"
              onClick={() => setSuccessfulOrderId(null)}
              className="mt-3 w-full rounded-full border px-5 py-3 font-bold"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
