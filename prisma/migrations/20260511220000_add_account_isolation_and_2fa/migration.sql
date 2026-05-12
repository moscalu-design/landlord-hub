-- Add user-owned rental data isolation and optional authenticator-app 2FA fields.
-- Existing rental data is assigned to admin@landlord.com as its isolated demo/test account.

ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;

UPDATE "User"
SET "role" = 'USER', "name" = CASE WHEN "name" = 'Admin' THEN 'Demo User' ELSE "name" END
WHERE "email" = 'admin@landlord.com';

ALTER TABLE "Property" ADD COLUMN "userId" TEXT;
ALTER TABLE "Room" ADD COLUMN "userId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "userId" TEXT;
ALTER TABLE "TenantDocument" ADD COLUMN "userId" TEXT;
ALTER TABLE "Occupancy" ADD COLUMN "userId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "userId" TEXT;
ALTER TABLE "Deposit" ADD COLUMN "userId" TEXT;
ALTER TABLE "DepositTransaction" ADD COLUMN "userId" TEXT;
ALTER TABLE "PropertyExpense" ADD COLUMN "userId" TEXT;
ALTER TABLE "Note" ADD COLUMN "userId" TEXT;
ALTER TABLE "Mortgage" ADD COLUMN "userId" TEXT;
ALTER TABLE "MortgagePrepayment" ADD COLUMN "userId" TEXT;
ALTER TABLE "RoomInventoryItem" ADD COLUMN "userId" TEXT;
ALTER TABLE "InventoryInspection" ADD COLUMN "userId" TEXT;
ALTER TABLE "InventoryInspectionItem" ADD COLUMN "userId" TEXT;
ALTER TABLE "InventoryInspectionPhoto" ADD COLUMN "userId" TEXT;

UPDATE "Property"
SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'admin@landlord.com' LIMIT 1)
WHERE "userId" IS NULL;

UPDATE "Tenant"
SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'admin@landlord.com' LIMIT 1)
WHERE "userId" IS NULL;

UPDATE "Room"
SET "userId" = (SELECT "userId" FROM "Property" WHERE "Property"."id" = "Room"."propertyId")
WHERE "userId" IS NULL;

UPDATE "PropertyExpense"
SET "userId" = (SELECT "userId" FROM "Property" WHERE "Property"."id" = "PropertyExpense"."propertyId")
WHERE "userId" IS NULL;

UPDATE "Mortgage"
SET "userId" = (SELECT "userId" FROM "Property" WHERE "Property"."id" = "Mortgage"."propertyId")
WHERE "userId" IS NULL;

UPDATE "MortgagePrepayment"
SET "userId" = (
  SELECT "Mortgage"."userId" FROM "Mortgage" WHERE "Mortgage"."id" = "MortgagePrepayment"."mortgageId"
)
WHERE "userId" IS NULL;

UPDATE "TenantDocument"
SET "userId" = (SELECT "userId" FROM "Tenant" WHERE "Tenant"."id" = "TenantDocument"."tenantId")
WHERE "userId" IS NULL;

UPDATE "Occupancy"
SET "userId" = (
  SELECT "Room"."userId" FROM "Room" WHERE "Room"."id" = "Occupancy"."roomId"
)
WHERE "userId" IS NULL;

UPDATE "Payment"
SET "userId" = (
  SELECT "Occupancy"."userId" FROM "Occupancy" WHERE "Occupancy"."id" = "Payment"."occupancyId"
)
WHERE "userId" IS NULL;

UPDATE "Deposit"
SET "userId" = (
  SELECT "Occupancy"."userId" FROM "Occupancy" WHERE "Occupancy"."id" = "Deposit"."occupancyId"
)
WHERE "userId" IS NULL;

UPDATE "DepositTransaction"
SET "userId" = (
  SELECT "Deposit"."userId" FROM "Deposit" WHERE "Deposit"."id" = "DepositTransaction"."depositId"
)
WHERE "userId" IS NULL;

UPDATE "Note"
SET "userId" = COALESCE(
  (SELECT "userId" FROM "Property" WHERE "Property"."id" = "Note"."propertyId"),
  (SELECT "userId" FROM "Room" WHERE "Room"."id" = "Note"."roomId"),
  (SELECT "userId" FROM "Tenant" WHERE "Tenant"."id" = "Note"."tenantId"),
  (SELECT "userId" FROM "Payment" WHERE "Payment"."id" = "Note"."paymentId")
)
WHERE "userId" IS NULL;

UPDATE "RoomInventoryItem"
SET "userId" = (SELECT "userId" FROM "Room" WHERE "Room"."id" = "RoomInventoryItem"."roomId")
WHERE "userId" IS NULL;

UPDATE "InventoryInspection"
SET "userId" = (
  SELECT "Occupancy"."userId" FROM "Occupancy" WHERE "Occupancy"."id" = "InventoryInspection"."occupancyId"
)
WHERE "userId" IS NULL;

UPDATE "InventoryInspectionItem"
SET "userId" = (
  SELECT "InventoryInspection"."userId" FROM "InventoryInspection"
  WHERE "InventoryInspection"."id" = "InventoryInspectionItem"."inspectionId"
)
WHERE "userId" IS NULL;

UPDATE "InventoryInspectionPhoto"
SET "userId" = (
  SELECT "InventoryInspection"."userId" FROM "InventoryInspection"
  WHERE "InventoryInspection"."id" = "InventoryInspectionPhoto"."inspectionId"
)
WHERE "userId" IS NULL;

CREATE INDEX "Property_userId_idx" ON "Property"("userId");
CREATE INDEX "Room_userId_idx" ON "Room"("userId");
CREATE INDEX "Tenant_userId_idx" ON "Tenant"("userId");
DROP INDEX IF EXISTS "Tenant_email_key";
CREATE UNIQUE INDEX "Tenant_userId_email_key" ON "Tenant"("userId", "email");
CREATE INDEX "TenantDocument_userId_idx" ON "TenantDocument"("userId");
CREATE INDEX "Occupancy_userId_idx" ON "Occupancy"("userId");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Deposit_userId_idx" ON "Deposit"("userId");
CREATE INDEX "DepositTransaction_userId_idx" ON "DepositTransaction"("userId");
CREATE INDEX "PropertyExpense_userId_idx" ON "PropertyExpense"("userId");
CREATE INDEX "Mortgage_userId_idx" ON "Mortgage"("userId");
CREATE INDEX "MortgagePrepayment_userId_idx" ON "MortgagePrepayment"("userId");
CREATE INDEX "RoomInventoryItem_userId_idx" ON "RoomInventoryItem"("userId");
CREATE INDEX "InventoryInspection_userId_idx" ON "InventoryInspection"("userId");
CREATE INDEX "InventoryInspectionItem_userId_idx" ON "InventoryInspectionItem"("userId");
CREATE INDEX "InventoryInspectionPhoto_userId_idx" ON "InventoryInspectionPhoto"("userId");
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");
