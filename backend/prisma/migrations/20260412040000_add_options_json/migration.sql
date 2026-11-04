-- Add options JSON field to categories
ALTER TABLE "CustomOrderCategoryDef" ADD COLUMN IF NOT EXISTS "options" TEXT;

-- Add selectedOptions JSON field to CustomOrder
ALTER TABLE "CustomOrder" ADD COLUMN IF NOT EXISTS "selectedOptions" TEXT;

-- Remove hasLength / hasSleeves if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CustomOrderCategoryDef' AND column_name = 'hasLength') THEN
    ALTER TABLE "CustomOrderCategoryDef" DROP COLUMN "hasLength";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CustomOrderCategoryDef' AND column_name = 'hasSleeves') THEN
    ALTER TABLE "CustomOrderCategoryDef" DROP COLUMN "hasSleeves";
  END IF;
END $$;

-- Seed default options for Cardigan (safe : only if options is null)
UPDATE "CustomOrderCategoryDef"
SET "options" = '[{"name":"Longueur","choices":["Court (Crop)","Hanches","Long"]},{"name":"Manches","choices":["Courtes","Régulières","Longues"]}]'
WHERE "code" = 'CARDIGAN' AND "options" IS NULL;
