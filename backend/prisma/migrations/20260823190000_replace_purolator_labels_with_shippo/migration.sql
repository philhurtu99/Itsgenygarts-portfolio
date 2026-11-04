ALTER TABLE "Order"
  ADD COLUMN "shippingRateId" TEXT,
  ADD COLUMN "shippingTrackingUrl" TEXT,
  ADD COLUMN "shippingTransactionId" TEXT,
  ADD COLUMN "shippingLabelPurchaseStartedAt" TIMESTAMP(3);
