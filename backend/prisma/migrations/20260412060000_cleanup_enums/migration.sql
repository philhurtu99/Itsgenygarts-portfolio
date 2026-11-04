-- Convert enum columns to text (preserves existing data)
ALTER TABLE "CustomOrder" ALTER COLUMN "colorStyle" TYPE TEXT USING "colorStyle"::TEXT;
ALTER TABLE "CustomOrder" ALTER COLUMN "rainbowMood" TYPE TEXT USING "rainbowMood"::TEXT;
ALTER TABLE "CustomOrder" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "CustomOrder" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- Drop legacy size columns (data now in selectedOptions JSON)
ALTER TABLE "CustomOrder" DROP COLUMN IF EXISTS "cardiganSize";
ALTER TABLE "CustomOrder" DROP COLUMN IF EXISTS "bonnetSize";
ALTER TABLE "CustomOrder" DROP COLUMN IF EXISTS "cardiganLength";
ALTER TABLE "CustomOrder" DROP COLUMN IF EXISTS "sleeveLength";

-- Drop unused enums
DROP TYPE IF EXISTS "CardiganSize";
DROP TYPE IF EXISTS "BonnetSize";
DROP TYPE IF EXISTS "CardiganLength";
DROP TYPE IF EXISTS "SleeveLength";
DROP TYPE IF EXISTS "ColorStyle";
DROP TYPE IF EXISTS "RainbowMood";
DROP TYPE IF EXISTS "CustomOrderStatus";
