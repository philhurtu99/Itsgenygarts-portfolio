ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "nameFr" TEXT,
  ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionFr" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;

UPDATE "Product"
SET
  "nameFr" = "name",
  "descriptionFr" = "description"
WHERE "nameFr" IS NULL OR "nameFr" = '';

ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "nameFr" TEXT,
  ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionFr" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;

UPDATE "Category"
SET
  "nameFr" = "name",
  "descriptionFr" = "description"
WHERE "nameFr" IS NULL OR "nameFr" = '';

ALTER TABLE "YarnProduct"
  ADD COLUMN IF NOT EXISTS "nameFr" TEXT,
  ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionFr" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;

UPDATE "YarnProduct"
SET
  "nameFr" = "name",
  "descriptionFr" = "description"
WHERE "nameFr" IS NULL OR "nameFr" = '';

ALTER TABLE "YarnCategory"
  ADD COLUMN IF NOT EXISTS "nameFr" TEXT,
  ADD COLUMN IF NOT EXISTS "nameEn" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionFr" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;

UPDATE "YarnCategory"
SET
  "nameFr" = "name",
  "descriptionFr" = "description"
WHERE "nameFr" IS NULL OR "nameFr" = '';
