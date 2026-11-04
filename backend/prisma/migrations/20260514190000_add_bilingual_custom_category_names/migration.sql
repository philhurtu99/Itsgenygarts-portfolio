ALTER TABLE "CustomOrderCategoryDef"
  ADD COLUMN IF NOT EXISTS "nameFr" TEXT,
  ADD COLUMN IF NOT EXISTS "nameEn" TEXT;

UPDATE "CustomOrderCategoryDef"
SET "nameFr" = "name"
WHERE "nameFr" IS NULL OR "nameFr" = '';
