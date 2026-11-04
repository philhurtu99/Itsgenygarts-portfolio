ALTER TABLE "Order"
ADD COLUMN "importFeesAcceptedAt" TIMESTAMP(3),
ADD COLUMN "importFeesPolicyVersion" TEXT,
ADD COLUMN "importFeesPolicyLanguage" TEXT,
ADD COLUMN "importFeesPolicyText" TEXT;
