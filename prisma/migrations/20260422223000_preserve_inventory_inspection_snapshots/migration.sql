-- Preserve inspection snapshots when a room inventory template item is removed.
-- Historical inspection rows carry itemName/condition/quantity snapshots and must not
-- be deleted just because the current inventory template changes.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_InventoryInspectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryInspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InventoryInspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryInspectionItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "RoomInventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_InventoryInspectionItem" (
    "id",
    "inspectionId",
    "inventoryItemId",
    "itemName",
    "condition",
    "quantity",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "inspectionId",
    "inventoryItemId",
    "itemName",
    "condition",
    "quantity",
    "notes",
    "createdAt",
    "updatedAt"
FROM "InventoryInspectionItem";

DROP TABLE "InventoryInspectionItem";
ALTER TABLE "new_InventoryInspectionItem" RENAME TO "InventoryInspectionItem";
CREATE UNIQUE INDEX "InventoryInspectionItem_inspectionId_inventoryItemId_key" ON "InventoryInspectionItem"("inspectionId", "inventoryItemId");

PRAGMA foreign_keys=ON;
