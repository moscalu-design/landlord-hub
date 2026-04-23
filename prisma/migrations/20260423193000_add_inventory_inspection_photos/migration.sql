CREATE TABLE "InventoryInspectionPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryInspectionPhoto_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InventoryInspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InventoryInspectionPhoto_inspectionId_idx" ON "InventoryInspectionPhoto"("inspectionId");
