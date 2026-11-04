-- Merge existing sizes into the options JSON before dropping them
DO $$
DECLARE
  rec RECORD;
  sizes_json TEXT;
  existing_opts TEXT;
  merged TEXT;
BEGIN
  FOR rec IN SELECT id, options FROM "CustomOrderCategoryDef" LOOP
    -- Build choices array from CustomOrderCategorySize for this category
    SELECT COALESCE(
      '[' || string_agg(
        '{"label":' || to_json(s."label")::text || ',"value":' || to_json(s."value")::text || '}',
        ','
        ORDER BY s."displayOrder"
      ) || ']',
      '[]'
    ) INTO sizes_json
    FROM "CustomOrderCategorySize" s WHERE s."categoryId" = rec.id;

    IF sizes_json IS DISTINCT FROM '[]' THEN
      -- Create a Grandeur option from sizes
      existing_opts := COALESCE(rec.options, '[]');
      -- Prepend Grandeur option to existing options
      IF existing_opts = '[]' OR existing_opts IS NULL THEN
        merged := '[{"name":"Grandeur","choices":' || sizes_json || '}]';
      ELSE
        merged := '[{"name":"Grandeur","choices":' || sizes_json || '},' || substring(existing_opts from 2);
      END IF;
      UPDATE "CustomOrderCategoryDef" SET "options" = merged WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- Drop sizes table
DROP TABLE IF EXISTS "CustomOrderCategorySize";

-- Drop hasSizes column
ALTER TABLE "CustomOrderCategoryDef" DROP COLUMN IF EXISTS "hasSizes";
