ALTER TABLE "FavoriteItem" ADD COLUMN "productVariantId" INTEGER;

UPDATE "FavoriteItem" fi
SET "productVariantId" = (
  SELECT pv."id"
  FROM "ProductVariant" pv
  WHERE pv."productId" = fi."productId"
    AND pv."status" = 'AVAILABLE'
  ORDER BY pv."sortOrder" ASC, pv."id" ASC
  LIMIT 1
)
WHERE fi."productVariantId" IS NULL;

DROP INDEX IF EXISTS "FavoriteItem_customerId_productId_key";

CREATE INDEX "FavoriteItem_customerId_productId_idx" ON "FavoriteItem"("customerId", "productId");
CREATE INDEX "FavoriteItem_productVariantId_idx" ON "FavoriteItem"("productVariantId");

ALTER TABLE "FavoriteItem" ADD CONSTRAINT "FavoriteItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
