/*
  Warnings:

  - A unique constraint covering the columns `[resetPasswordToken]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_resetPasswordToken_key" ON "Customer"("resetPasswordToken");
