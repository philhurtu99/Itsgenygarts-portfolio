ALTER TABLE "Product"
  ADD COLUMN "packageWeightGrams" INTEGER,
  ADD COLUMN "packageLengthCm" DECIMAL(8,2),
  ADD COLUMN "packageWidthCm" DECIMAL(8,2),
  ADD COLUMN "packageHeightCm" DECIMAL(8,2);

ALTER TABLE "Order"
  ADD COLUMN "shippingProvider" TEXT,
  ADD COLUMN "shippingServiceCode" TEXT,
  ADD COLUMN "shippingServiceName" TEXT,
  ADD COLUMN "shippingTrackingIncluded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shippingEstimatedDays" INTEGER,
  ADD COLUMN "shippingPackage" JSONB;
