CREATE TABLE "FavoriteItem" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FavoriteItem_customerId_productId_key" ON "FavoriteItem"("customerId", "productId");
CREATE INDEX "FavoriteItem_customerId_idx" ON "FavoriteItem"("customerId");

ALTER TABLE "FavoriteItem" ADD CONSTRAINT "FavoriteItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteItem" ADD CONSTRAINT "FavoriteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
