-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductShippingRate" DROP CONSTRAINT "ProductShippingRate_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductShippingRate" DROP CONSTRAINT "ProductShippingRate_shippingZoneId_fkey";

-- AlterTable
ALTER TABLE "CustomOrder" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "stripePaymentId" TEXT,
ADD COLUMN     "stripeSessionId" TEXT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PersonalizedQuote" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "price" DECIMAL(10,2),
ADD COLUMN     "stripePaymentId" TEXT,
ADD COLUMN     "stripeSessionId" TEXT;

-- AddForeignKey
ALTER TABLE "ProductShippingRate" ADD CONSTRAINT "ProductShippingRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductShippingRate" ADD CONSTRAINT "ProductShippingRate_shippingZoneId_fkey" FOREIGN KEY ("shippingZoneId") REFERENCES "ShippingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
