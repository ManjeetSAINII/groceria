-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingPayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER,
    "razorpayOrderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PendingPayment" ("address", "amount", "city", "createdAt", "currency", "customerName", "id", "itemsJson", "phone", "pincode", "razorpayOrderId", "status", "updatedAt") SELECT "address", "amount", "city", "createdAt", "currency", "customerName", "id", "itemsJson", "phone", "pincode", "razorpayOrderId", "status", "updatedAt" FROM "PendingPayment";
DROP TABLE "PendingPayment";
ALTER TABLE "new_PendingPayment" RENAME TO "PendingPayment";
CREATE UNIQUE INDEX "PendingPayment_razorpayOrderId_key" ON "PendingPayment"("razorpayOrderId");
CREATE INDEX "PendingPayment_customerId_idx" ON "PendingPayment"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
