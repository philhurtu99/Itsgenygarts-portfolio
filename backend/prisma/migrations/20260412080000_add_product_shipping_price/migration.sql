-- Add shippingPrice directly on Product (flat rate per product)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
