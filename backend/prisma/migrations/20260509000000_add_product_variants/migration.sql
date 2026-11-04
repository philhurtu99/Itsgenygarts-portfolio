-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN "variantId" INTEGER;

-- AlterTable
ALTER TABLE "StockReservation" ADD COLUMN "productVariantId" INTEGER;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "productVariantId" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "variantLabelSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantImageUrl" TEXT;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN "productVariantId" INTEGER;

-- DropIndex
DROP INDEX IF EXISTS "CartItem_customerId_productId_key";

-- CreateIndex
CREATE INDEX "ProductVariant_productId_status_sortOrder_idx" ON "ProductVariant"("productId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

-- CreateIndex
CREATE INDEX "StockReservation_productVariantId_idx" ON "StockReservation"("productVariantId");

-- CreateIndex
CREATE INDEX "CartItem_customerId_productId_idx" ON "CartItem"("customerId", "productId");

-- CreateIndex
CREATE INDEX "CartItem_productVariantId_idx" ON "CartItem"("productVariantId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed variants for existing products that already have multiple available units.
-- Labels are computed dynamically from sortOrder, so only stable row order is stored.
INSERT INTO "ProductVariant" ("productId", "status", "sortOrder", "createdAt", "updatedAt")
SELECT
  p."id",
  'AVAILABLE',
  series.n - 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product" p
CROSS JOIN LATERAL generate_series(1, LEAST(p."stockQuantity", 26)) AS series(n)
WHERE p."stockQuantity" > 1
  AND p."isDeleted" = false;
