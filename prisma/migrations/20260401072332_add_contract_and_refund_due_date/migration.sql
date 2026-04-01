-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN "refundDueDate" DATETIME;

-- AlterTable
ALTER TABLE "Occupancy" ADD COLUMN "contractFileName" TEXT;
ALTER TABLE "Occupancy" ADD COLUMN "contractFileSize" INTEGER;
ALTER TABLE "Occupancy" ADD COLUMN "contractStorageUrl" TEXT;
ALTER TABLE "Occupancy" ADD COLUMN "contractUploadedAt" DATETIME;
