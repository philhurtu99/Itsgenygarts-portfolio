-- CreateEnum
CREATE TYPE "CustomOrderCategory" AS ENUM ('CARDIGAN', 'BONNET');

-- CreateEnum
CREATE TYPE "CardiganSize" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'XXXXXL');

-- CreateEnum
CREATE TYPE "BonnetSize" AS ENUM ('PREEMIE', 'NEWBORN_3M', 'THREE_6M', 'SIX_12M', 'TWELVE_24M', 'CHILD', 'TEEN_SMALL_ADULT', 'MEDIUM_ADULT', 'LARGE_ADULT');

-- CreateEnum
CREATE TYPE "CardiganLength" AS ENUM ('CROP', 'HIPS', 'LONG');

-- CreateEnum
CREATE TYPE "SleeveLength" AS ENUM ('SHORT', 'REGULAR', 'LONG');

-- CreateEnum
CREATE TYPE "ColorStyle" AS ENUM ('SAME_AS_REFERENCE', 'SOLID_COLOR', 'MULTIPLE_SOLID_COLORS', 'COLOR_CHANGING_YARN', 'RAINBOW');

-- CreateEnum
CREATE TYPE "RainbowMood" AS ENUM ('PASTEL', 'BRIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "CustomOrderStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "soldOut" BOOLEAN NOT NULL DEFAULT false,
    "mainImageUrl" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCollection" (
    "productId" INTEGER NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId")
);

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" SERIAL NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "shippingAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequestItem" (
    "id" SERIAL NOT NULL,
    "quoteRequestId" INTEGER NOT NULL,
    "productId" INTEGER,
    "productName" TEXT NOT NULL,
    "productPrice" DECIMAL(10,2) NOT NULL,
    "productImageUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "QuoteRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReference" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT,
    "productId" INTEGER,

    CONSTRAINT "ProductReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomModelOption" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "CustomModelOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrder" (
    "id" SERIAL NOT NULL,
    "productReferenceId" INTEGER,
    "customModelOptionId" INTEGER,
    "category" "CustomOrderCategory" NOT NULL,
    "cardiganSize" "CardiganSize",
    "bonnetSize" "BonnetSize",
    "cardiganLength" "CardiganLength",
    "sleeveLength" "SleeveLength",
    "colorStyle" "ColorStyle" NOT NULL,
    "selectedColors" TEXT,
    "colorChangingTheme" TEXT,
    "rainbowMood" "RainbowMood",
    "description" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerAddress" TEXT NOT NULL,
    "customerCity" TEXT NOT NULL,
    "customerProvince" TEXT,
    "customerPostalCode" TEXT NOT NULL,
    "customerCountry" TEXT NOT NULL,
    "status" "CustomOrderStatus" NOT NULL DEFAULT 'NEW',
    "createdAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrderImage" (
    "id" SERIAL NOT NULL,
    "customOrderId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storagePathOrUrl" TEXT NOT NULL,
    "uploadedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomOrderImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'User',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_name_key" ON "Collection"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomModelOption_code_key" ON "CustomModelOption"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequestItem" ADD CONSTRAINT "QuoteRequestItem_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequestItem" ADD CONSTRAINT "QuoteRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReference" ADD CONSTRAINT "ProductReference_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_productReferenceId_fkey" FOREIGN KEY ("productReferenceId") REFERENCES "ProductReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_customModelOptionId_fkey" FOREIGN KEY ("customModelOptionId") REFERENCES "CustomModelOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderImage" ADD CONSTRAINT "CustomOrderImage_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
