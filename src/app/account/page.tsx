"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Customer = {
  id: number;
  name: string | null;
  phone: string;
};

type OrderItem = {
  id: number;
  productName: string;
  price: number;
  quantity: number;
};

type Order = {
  id: number;
  customerName: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

export default function AccountPage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [profileName, setProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      try {
        const meResponse = await fetch("/api/customer/me", {
          cache: "no-store",
        });

        if (!meResponse.ok) {
          if (active) setError("Please log in to view your account.");
          return;
        }

        const meData = await meResponse.json();

        if (!meData.customer) {
          if (active) setError("Please log in to view your account.");
          return;
        }

        if (active) {
          setCustomer(meData.customer);
          setProfileName(meData.customer.name ?? "");
        }
        const ordersResponse = await fetch("/api/customer/orders", {
          cache: "no-store",
        });

        if (!ordersResponse.ok) {
          throw new Error("Unable to load your orders.");
        }

        const ordersData = await ordersResponse.json();

        if (active) setOrders(ordersData.orders ?? []);
      } catch {
        if (active) setError("Unable to load your account. Try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");

    const name = profileName.trim();

    if (name.length < 2 || name.length > 80) {
      setProfileMessage("Name must contain 2 to 80 characters.");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save profile");
      }

      setCustomer(data.customer);
      setProfileName(data.customer.name ?? "");
      setProfileMessage("Profile updated successfully!");
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Unable to save profile",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function logout() {
    setLoggingOut(true);

    try {
      const response = await fetch("/api/customer/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      window.location.href = "/";
    } catch {
      setError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }

  const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff8f2",
        padding: "24px 16px",
        color: "#292524",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <Link
            href="/"
            style={{
              color: "#e65c22",
              fontWeight: 800,
              fontSize: 25,
              textDecoration: "none",
            }}
          >
            Groceria
          </Link>

          <Link
            href="/"
            style={{
              color: "#e65c22",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Continue Shopping
          </Link>
        </header>

        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 20 }}>
          My Account
        </h1>

        {loading ? (
          <p>Loading your account...</p>
        ) : !customer ? (
          <section style={cardStyle}>
            <p>{error || "Please log in to continue."}</p>
            <Link href="/" style={linkStyle}>
              Go to Login
            </Link>
          </section>
        ) : (
          <>
            <section style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2 style={headingStyle}>My Profile</h2>
                  <p>
                    <strong>Name:</strong> {customer.name || "Not added yet"}
                  </p>
                  <p>
                    <strong>Mobile:</strong> {customer.phone}
                  </p>

                  <form
                    onSubmit={saveProfile}
                    style={{
                      marginTop: 20,
                      display: "grid",
                      gap: 12,
                      maxWidth: 350,
                    }}
                  >
                    <label
                      htmlFor="profile-name"
                      style={{ fontWeight: 700, fontSize: 14 }}
                    >
                      Edit Your Name
                    </label>

                    <input
                      id="profile-name"
                      type="text"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      placeholder="Enter your full name"
                      minLength={2}
                      maxLength={80}
                      required
                      style={{
                        padding: "12px",
                        borderRadius: 10,
                        border: "1px solid #e9dccb",
                        background: "white",
                        color: "#292524",
                      }}
                    />

                    <button
                      type="submit"
                      disabled={savingProfile}
                      style={{
                        background: "#e65c22",
                        color: "white",
                        border: 0,
                        borderRadius: 10,
                        padding: "12px 18px",
                        fontWeight: 700,
                        cursor: savingProfile ? "wait" : "pointer",
                        opacity: savingProfile ? 0.6 : 1,
                      }}
                    >
                      {savingProfile ? "Saving..." : "Save Profile"}
                    </button>

                    {profileMessage && (
                      <p role="status" style={{ fontSize: 13 }}>
                        {profileMessage}
                      </p>
                    )}
                  </form>
                </div>

                <button
                  onClick={logout}
                  disabled={loggingOut}
                  style={{
                    background: "#e65c22",
                    color: "white",
                    padding: "11px 20px",
                    borderRadius: 10,
                    border: 0,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </section>

            <section style={{ marginTop: 28 }}>
              <h2 style={{ ...headingStyle, fontSize: 24 }}>
                My Orders ({orders.length})
              </h2>

              {error && (
                <p style={{ color: "#b91c1c", marginBottom: 12 }}>{error}</p>
              )}

              {orders.length === 0 ? (
                <div style={cardStyle}>
                  <p>You haven't placed any linked orders yet.</p>
                  <Link href="/#products" style={linkStyle}>
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  {orders.map((order) => (
                    <article key={order.id} style={cardStyle}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 14,
                        }}
                      >
                        <div>
                          <h3 style={{ fontWeight: 800, fontSize: 18 }}>
                            Order #{order.id}
                          </h3>
                          <p style={{ color: "#78716c", fontSize: 14 }}>
                            {new Date(order.createdAt).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <strong style={{ fontSize: 20 }}>
                          {money(order.total)}
                        </strong>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          marginBottom: 16,
                        }}
                      >
                        <span style={pillStyle}>Delivery: {order.status}</span>
                        <span style={pillStyle}>
                          Payment: {order.paymentStatus}
                        </span>
                        <span style={pillStyle}>{order.paymentMethod}</span>
                      </div>

                      <div
                        style={{
                          borderTop: "1px solid #f1e2d6",
                          paddingTop: 12,
                        }}
                      >
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              padding: "6px 0",
                            }}
                          >
                            <span>
                              {item.productName} × {item.quantity}
                            </span>
                            <span>{money(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <Link
                        href={`/track-order?orderId=${order.id}`}
                        style={{
                          ...linkStyle,
                          display: "inline-block",
                          marginTop: 14,
                        }}
                      >
                        Track Order →
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  padding: 22,
  borderRadius: 16,
  border: "1px solid #f1e2d6",
  boxShadow: "0 4px 16px rgba(80, 40, 20, 0.05)",
};

const headingStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  marginBottom: 12,
};

const linkStyle: React.CSSProperties = {
  color: "#e65c22",
  fontWeight: 700,
  textDecoration: "none",
};

const pillStyle: React.CSSProperties = {
  background: "#fff0e4",
  color: "#9a3412",
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
};
