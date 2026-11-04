ALTER TABLE "CustomOrder"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'WEBSITE',
ADD COLUMN "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID';

UPDATE "CustomOrder"
SET
  "amountPaid" = COALESCE("price", 0),
  "paymentStatus" = 'PAID'
WHERE "paidAt" IS NOT NULL OR "status" = 'PAID';

CREATE TABLE "CustomOrderPayment" (
  "id" SERIAL NOT NULL,
  "customOrderId" INTEGER NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "kind" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "stripePaymentId" TEXT,
  "stripeSessionId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomOrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomOrderPayment_stripePaymentId_key" ON "CustomOrderPayment"("stripePaymentId");
CREATE UNIQUE INDEX "CustomOrderPayment_stripeSessionId_key" ON "CustomOrderPayment"("stripeSessionId");
CREATE INDEX "CustomOrderPayment_customOrderId_status_idx" ON "CustomOrderPayment"("customOrderId", "status");

ALTER TABLE "CustomOrderPayment"
ADD CONSTRAINT "CustomOrderPayment_customOrderId_fkey"
FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
