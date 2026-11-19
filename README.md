<div align="center">

<img src="./docs/assets/Groceria Fresh Grocery Banner.png" alt="Groceria Banner" width="100%" />
<br />

**A modern, full-stack grocery shopping experience.**

Browse products, manage your cart, place orders, and run your store from a dedicated admin dashboard.

[![Live Website](https://img.shields.io/badge/Live%20Website-Visit%20Groceria-16815e?style=for-the-badge&logo=vercel&logoColor=white)](https://groceria-cyhs.vercel.app)
[![GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/ManjeetSAINII/groceria)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![TiDB](https://img.shields.io/badge/TiDB-Cloud-4479A1?logo=mysql&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)

</div>

---

## ✨ Overview

**Groceria** is a custom-built grocery e-commerce application powered by **Next.js App Router**, **Prisma**, and **TiDB Cloud**. It combines a responsive customer storefront with an authenticated admin workspace for day-to-day product management.

> **Project status:** Deployed for testing and ongoing development. Some integrations, including customer OTP authentication, currently use test configurations and are **not production-ready**.

## 🛍️ Features

| Customer experience | Store administration |
| --- | --- |
| 🔎 Search products by name | 🔐 Password-protected admin login |
| 🧺 Browse and filter by category | ➕ Add products and descriptions |
| 🛒 Add products to cart and change quantities | 📦 Manage prices, stock and availability |
| 📱 Responsive shopping interface | 🖼️ Configure product images |
| 💳 Online payment and cash-on-delivery flows | 🔄 Update the live product catalog |
| 📋 Customer accounts and order records | 🗄️ Database-backed inventory |

> Payment options and order flows are implemented in the project; verify the complete payment and fulfillment lifecycle before accepting live orders.

## 🖥️ Explore the application

<div align="center">

| Storefront | Admin dashboard |
| :---: | :---: |
| [**Open live store ↗**](https://groceria-cyhs.vercel.app) | [**Admin login ↗**](https://groceria-cyhs.vercel.app/admin/login) |
| Browse products, search, filter, and use the cart | Manage the catalog through a protected interface |

</div>

<!-- Add genuine screenshots here after capturing them from your app:
![Storefront screenshot](./docs/assets/storefront.png)
![Admin dashboard screenshot](./docs/assets/admin-dashboard.png)
-->

## 🏗️ Architecture

```mermaid
flowchart TB
    C[🛍️ Customer] --> W[Next.js storefront]
    A[🔐 Admin] --> D[Admin dashboard]
    W --> API[Next.js API routes]
    D --> API
    API --> P[Prisma ORM]
    P --> DB[(TiDB Cloud · MySQL)]
    API --> PAY[Razorpay · payment integration]
    V[Vercel hosting] -. deploys .-> W
    V -. deploys .-> D
    classDef ui fill:#e8f7ee,stroke:#16815e,color:#123e2d
    classDef service fill:#eef3ff,stroke:#6176c8,color:#233257
    class C,A,W,D ui
    class API,P,DB,PAY,V service
```

### Order journey

```mermaid
flowchart LR
    B[Browse] --> S[Select products]
    S --> C[Cart]
    C --> O[Checkout]
    O --> M{Payment method}
    M -->|Cash on delivery| COD[COD order]
    M -->|Online| R[Razorpay flow]
    COD --> DB[(Order records)]
    R --> DB
```

*Diagrams show the intended high-level application flow; they are not a security or payment verification audit.*

## 🧰 Tech stack

| Layer | Technology |
| --- | --- |
| Web application | Next.js 16, React, TypeScript |
| Backend | Next.js Route Handlers |
| Database | TiDB Cloud (MySQL-compatible) |
| ORM | Prisma |
| Hosting | Vercel |
| Payments | Razorpay (test integration), Cash on Delivery |
| Authentication | Admin password/session; customer test OTP/session |
| Local development | Node.js 20+, npm |

## 🚀 Run locally

**Prerequisites:** Node.js 20+, npm, and access to a compatible MySQL/TiDB database.

```bash
git clone https://github.com/ManjeetSAINII/groceria.git
cd groceria
npm install
```

Configure your local environment using the variable **names** below. Do not commit credentials or copy production secrets into the repository.

```dotenv
DATABASE_URL="mysql://USER:PASSWORD@HOST:4000/groceria?sslaccept=strict"
ADMIN_PASSWORD_HASH="<bcrypt-hash>"
ADMIN_SESSION_SECRET="<random-secret-at-least-32-characters>"
CUSTOMER_SESSION_SECRET="<random-secret-at-least-32-characters>"
CUSTOMER_TEST_OTP_ENABLED="false"
CUSTOMER_TEST_OTP="<six-digit-test-code>"
RAZORPAY_KEY_ID="<test-key-id>"
RAZORPAY_KEY_SECRET="<test-key-secret>"
RAZORPAY_WEBHOOK_SECRET="<webhook-secret>"
```

Generate the Prisma client and start the development server:

```bash
npx prisma generate --config prisma.tidb.config.ts
npm run dev
```

Open **http://localhost:3000**.

> **Database configuration:** This repository uses `prisma.tidb.config.ts` and may load `.env.tidb` for local Prisma commands. Check that file and the project's scripts before running migrations. Do **not** run a destructive migration or data import against an existing production database.

## 🗂️ Key application routes

| Route | Purpose |
| --- | --- |
| `/` | Customer storefront |
| `/admin/login` | Admin sign-in |
| `/admin` | Admin product dashboard |
| `/api/products` | Product catalog API |
| `/api/admin/login` | Admin authentication endpoint |
| `/api/customer/login` | Customer login endpoint |

## 🔒 Security and deployment notes

- **Customer test OTP is for testing only.** A shared fixed code must not be used to authenticate real customers on a public store; use a protected testing environment or replace it with real verification before launch.
- Store secrets in **Vercel Environment Variables**, not in Git or the README.
- Rotate credentials if they have ever been exposed in messages, screenshots, logs, or commits.
- Verify Razorpay payment signatures, webhooks, COD behavior, and order state transitions before enabling live payments.
- Product images saved to local filesystem paths may not persist on serverless hosting; use persistent object storage for uploaded images.

## 🛣️ Roadmap

- [ ] Production-ready phone verification
- [ ] Persistent cloud image storage
- [ ] End-to-end payment and webhook verification
- [ ] More complete order management and fulfillment tools
- [ ] Storefront and dashboard screenshots
- [ ] Automated tests and CI checks

## 🤝 Contributing

This is an actively developed project. Issues and suggestions are welcome through [GitHub Issues](https://github.com/ManjeetSAINII/groceria/issues).

---

<div align="center">

**Built with care for everyday shopping.** 🌿

[🌐 Live Store](https://groceria-cyhs.vercel.app) · [💻 Repository](https://github.com/ManjeetSAINII/groceria)

</div>
