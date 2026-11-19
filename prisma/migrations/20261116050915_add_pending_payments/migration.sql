-- CreateTable
CREATE TABLE "PendingPayment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingPayment_razorpayOrderId_key" ON "PendingPayment"("razorpayOrderId");
