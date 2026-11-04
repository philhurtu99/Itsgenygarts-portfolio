-- Replace single shippingPrice with per-zone columns
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingQC" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingCA" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingUS" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingINT" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Copy old shippingPrice to all zones if it existed
UPDATE "Product" SET "shippingQC" = "shippingPrice", "shippingCA" = "shippingPrice", "shippingUS" = "shippingPrice", "shippingINT" = "shippingPrice" WHERE "shippingPrice" > 0;

-- Drop old column
ALTER TABLE "Product" DROP COLUMN IF EXISTS "shippingPrice";
