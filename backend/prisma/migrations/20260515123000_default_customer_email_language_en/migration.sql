ALTER TABLE "Customer" ALTER COLUMN "preferredLanguage" SET DEFAULT 'en';
ALTER TABLE "Order" ALTER COLUMN "customerLanguage" SET DEFAULT 'en';
ALTER TABLE "CustomOrder" ALTER COLUMN "customerLanguage" SET DEFAULT 'en';
ALTER TABLE "PersonalizedQuote" ALTER COLUMN "customerLanguage" SET DEFAULT 'en';
ALTER TABLE "QuoteRequest" ALTER COLUMN "customerLanguage" SET DEFAULT 'en';
