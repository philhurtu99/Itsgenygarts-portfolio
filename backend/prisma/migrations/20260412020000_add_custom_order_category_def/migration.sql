-- CreateTable
CREATE TABLE "CustomOrderCategoryDef" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sizeGroup" TEXT NOT NULL DEFAULT 'NONE',
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CustomOrderCategoryDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrderCategoryDef_code_key" ON "CustomOrderCategoryDef"("code");

-- Seed default categories
INSERT INTO "CustomOrderCategoryDef" ("name", "code", "sizeGroup", "icon", "displayOrder")
VALUES
  ('Cardigan', 'CARDIGAN', 'CARDIGAN', '🧥', 0),
  ('Bonnet',   'BONNET',   'BONNET',   '🧢', 1);

-- Convert CustomOrder.category from enum to text
ALTER TABLE "CustomOrder" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

-- Drop the old enum
DROP TYPE IF EXISTS "CustomOrderCategory";
