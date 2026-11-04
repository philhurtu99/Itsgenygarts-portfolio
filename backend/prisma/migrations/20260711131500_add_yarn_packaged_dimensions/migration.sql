ALTER TABLE "YarnProduct"
  ADD COLUMN "packageWeightGrams" INTEGER,
  ADD COLUMN "packageLengthCm" DECIMAL(8,2),
  ADD COLUMN "packageWidthCm" DECIMAL(8,2),
  ADD COLUMN "packageHeightCm" DECIMAL(8,2);
