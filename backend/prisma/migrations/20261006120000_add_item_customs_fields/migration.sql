ALTER TABLE "Product"
  ADD COLUMN "customsDescription" TEXT,
  ADD COLUMN "customsWeightGrams" DECIMAL(10,2),
  ADD COLUMN "customsOriginCountry" TEXT,
  ADD COLUMN "customsHsCode" TEXT;

ALTER TABLE "YarnProduct"
  ADD COLUMN "customsDescription" TEXT,
  ADD COLUMN "customsWeightGrams" DECIMAL(10,2),
  ADD COLUMN "customsOriginCountry" TEXT,
  ADD COLUMN "customsHsCode" TEXT;
