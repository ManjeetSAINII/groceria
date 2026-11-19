require("dotenv").config();

async function main() {
  const response = await fetch(
    "http://localhost:3100/api/customer/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "9999900001",
        otp: process.env.CUSTOMER_TEST_OTP
      })
    }
  );

  const data = await response.json();
  const cookie = response.headers.get("set-cookie");

  console.log("Login HTTP status:", response.status);
  console.log("Customer ID:", data.customer?.id ?? "Not returned");
  console.log(
    "Session cookie received:",
    Boolean(cookie?.includes("customer_session="))
  );

  if (!response.ok) {
    console.log("Error:", data.error);
  }
}

main().catch(console.error);
