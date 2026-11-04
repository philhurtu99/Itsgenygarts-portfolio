ALTER TABLE "Customer"
ADD COLUMN "deleteAccountToken" TEXT,
ADD COLUMN "deleteAccountExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX "Customer_deleteAccountToken_key" ON "Customer"("deleteAccountToken");
