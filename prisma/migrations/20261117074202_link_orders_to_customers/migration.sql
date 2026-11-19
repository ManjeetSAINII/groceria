-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'COD',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("address", "city", "createdAt", "customerName", "id", "paymentMethod", "paymentStatus", "phone", "pincode", "razorpayOrderId", "razorpayPaymentId", "status", "total") SELECT "address", "city", "createdAt", "customerName", "id", "paymentMethod", "paymentStatus", "phone", "pincode", "razorpayOrderId", "razorpayPaymentId", "status", "total" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_razorpayOrderId_key" ON "Order"("razorpayOrderId");
CREATE UNIQUE INDEX "Order_razorpayPaymentId_key" ON "Order"("razorpayPaymentId");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
