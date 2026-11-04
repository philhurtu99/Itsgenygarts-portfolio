-- CreateTable
CREATE TABLE "PersonalizedQuote" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerAddress" TEXT NOT NULL,
    "customerCity" TEXT NOT NULL,
    "customerProvince" TEXT,
    "customerPostalCode" TEXT NOT NULL,
    "customerCountry" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizedQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizedQuoteImage" (
    "id" SERIAL NOT NULL,
    "personalizedQuoteId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storagePathOrUrl" TEXT NOT NULL,
    "uploadedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizedQuoteImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PersonalizedQuoteImage" ADD CONSTRAINT "PersonalizedQuoteImage_personalizedQuoteId_fkey" FOREIGN KEY ("personalizedQuoteId") REFERENCES "PersonalizedQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
