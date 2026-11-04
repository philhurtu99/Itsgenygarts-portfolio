-- Shipping zones (admin-configured regions)
CREATE TABLE IF NOT EXISTS "ShippingZone" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "countries" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0
);

-- Per-product shipping rate per zone
CREATE TABLE IF NOT EXISTS "ProductShippingRate" (
  "id" SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL,
  "shippingZoneId" INTEGER NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "ProductShippingRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
  CONSTRAINT "ProductShippingRate_shippingZoneId_fkey" FOREIGN KEY ("shippingZoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE,
  CONSTRAINT "ProductShippingRate_productId_shippingZoneId_key" UNIQUE ("productId", "shippingZoneId")
);

-- Currency exchange rates (admin-configured)
CREATE TABLE IF NOT EXISTS "CurrencyRate" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "symbol" TEXT NOT NULL,
  "rate" DECIMAL(12,6) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- Seed default currencies
INSERT INTO "CurrencyRate" ("code", "symbol", "rate", "isActive")
VALUES ('CAD', '$', 1.000000, true),
       ('USD', '$', 0.740000, true),
       ('EUR', '€', 0.680000, true)
ON CONFLICT ("code") DO NOTHING;

-- Seed default shipping zones
INSERT INTO "ShippingZone" ("name", "countries", "isActive", "displayOrder")
VALUES ('Québec', 'CA-QC', true, 0),
       ('Canada', 'CA', true, 1),
       ('États-Unis', 'US', true, 2),
       ('International', '*', true, 3)
ON CONFLICT ("name") DO NOTHING;

-- Orders
CREATE TABLE IF NOT EXISTS "Order" (
  "id" SERIAL PRIMARY KEY,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT,
  "customerAddress" TEXT NOT NULL,
  "customerCity" TEXT NOT NULL,
  "customerProvince" TEXT,
  "customerPostalCode" TEXT NOT NULL,
  "customerCountry" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "subtotal" DECIMAL(10,2) NOT NULL,
  "shippingTotal" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "stripeSessionId" TEXT,
  "stripePaymentId" TEXT,
  "paidAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order items
CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "productId" INTEGER,
  "productName" TEXT NOT NULL,
  "productImageUrl" TEXT,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "shippingPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "quantity" INTEGER NOT NULL,
  "subtotal" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
  CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL
);
