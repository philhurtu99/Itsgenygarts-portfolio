ALTER TABLE "CustomOrderImage"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'REFERENCE';

CREATE INDEX "CustomOrderImage_customOrderId_purpose_idx"
ON "CustomOrderImage"("customOrderId", "purpose");
