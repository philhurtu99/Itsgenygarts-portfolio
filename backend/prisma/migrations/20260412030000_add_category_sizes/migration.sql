-- Add new boolean columns to CustomOrderCategoryDef
ALTER TABLE "CustomOrderCategoryDef" ADD COLUMN IF NOT EXISTS "hasSizes"   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CustomOrderCategoryDef" ADD COLUMN IF NOT EXISTS "hasLength"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomOrderCategoryDef" ADD COLUMN IF NOT EXISTS "hasSleeves" BOOLEAN NOT NULL DEFAULT false;

-- Migrate sizeGroup → booleans (only if column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CustomOrderCategoryDef' AND column_name = 'sizeGroup'
  ) THEN
    UPDATE "CustomOrderCategoryDef" SET "hasLength" = true, "hasSleeves" = true WHERE "sizeGroup" = 'CARDIGAN';
    UPDATE "CustomOrderCategoryDef" SET "hasSizes"  = false                        WHERE "sizeGroup" = 'NONE';
    ALTER TABLE "CustomOrderCategoryDef" DROP COLUMN "sizeGroup";
  END IF;
END $$;

-- Create sizes table
CREATE TABLE IF NOT EXISTS "CustomOrderCategorySize" (
    "id"           SERIAL  NOT NULL,
    "categoryId"   INTEGER NOT NULL,
    "label"        TEXT    NOT NULL,
    "value"        TEXT    NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CustomOrderCategorySize_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomOrderCategorySize_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "CustomOrderCategoryDef"("id") ON DELETE CASCADE
);

-- Seed grandeurs Cardigan (safe : insère seulement si la catégorie n'en a pas encore)
INSERT INTO "CustomOrderCategorySize" ("categoryId", "label", "value", "displayOrder")
SELECT c.id, s.label, s.value, s.ord
FROM "CustomOrderCategoryDef" c
CROSS JOIN (VALUES
  ('XS',            'XS',       0),
  ('S',             'S',        1),
  ('M',             'M',        2),
  ('L',             'L',        3),
  ('XL',            'XL',       4),
  ('2XL',           'XXL',      5),
  ('3XL',           'XXXL',     6),
  ('4XL',           'XXXXL',    7),
  ('5XL',           'XXXXXL',   8)
) AS s(label, value, ord)
WHERE c.code = 'CARDIGAN'
  AND NOT EXISTS (
    SELECT 1 FROM "CustomOrderCategorySize" WHERE "categoryId" = c.id
  );

-- Seed grandeurs Bonnet (safe)
INSERT INTO "CustomOrderCategorySize" ("categoryId", "label", "value", "displayOrder")
SELECT c.id, s.label, s.value, s.ord
FROM "CustomOrderCategoryDef" c
CROSS JOIN (VALUES
  ('Prématuré',           'PREEMIE',          0),
  ('Nouveau-né (0-3M)',   'NEWBORN_3M',        1),
  ('Bébé 3-6M',          'THREE_6M',          2),
  ('Bébé 6-12M',         'SIX_12M',           3),
  ('Bébé 12-24M',        'TWELVE_24M',        4),
  ('Enfant (3-10 ans)',   'CHILD',             5),
  ('Ado / Petit adulte',  'TEEN_SMALL_ADULT',  6),
  ('Adulte moyen',        'MEDIUM_ADULT',      7),
  ('Grand adulte',        'LARGE_ADULT',       8)
) AS s(label, value, ord)
WHERE c.code = 'BONNET'
  AND NOT EXISTS (
    SELECT 1 FROM "CustomOrderCategorySize" WHERE "categoryId" = c.id
  );
