CREATE TABLE "YarnCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YarnCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "YarnProduct" (
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

    CONSTRAINT "YarnProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "YarnImage" (
    "id" SERIAL NOT NULL,
    "yarnProductId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "YarnImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "YarnCategory_name_key" ON "YarnCategory"("name");

ALTER TABLE "YarnProduct" ADD CONSTRAINT "YarnProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "YarnCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "YarnImage" ADD CONSTRAINT "YarnImage_yarnProductId_fkey" FOREIGN KEY ("yarnProductId") REFERENCES "YarnProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
