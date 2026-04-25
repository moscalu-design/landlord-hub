-- Add optional per-item linkage on inspection photos.
-- Existing rows keep inspectionItemId = NULL (inspection-level / general photos).
--
-- Note: libsql (Turso) rejects inline REFERENCES in ALTER TABLE ADD COLUMN, so the
-- foreign-key constraint is enforced at the application layer via the Prisma client.
-- onDelete CASCADE for this relation is declared in schema.prisma and runs through
-- the adapter; orphans are additionally avoided because the parent row cascades
-- delete photos via the existing inspectionId FK.

ALTER TABLE "InventoryInspectionPhoto" ADD COLUMN "inspectionItemId" TEXT;

CREATE INDEX "InventoryInspectionPhoto_inspectionItemId_idx"
ON "InventoryInspectionPhoto"("inspectionItemId");
