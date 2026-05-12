-- Add property rental mode, whole-property rent, and static property information.
-- Existing properties keep ROOM_LEVEL behaviour. Rooms gain a marker for the
-- hidden whole-property unit used by FULL_PROPERTY rentals.

ALTER TABLE "Property" ADD COLUMN "rentalMode" TEXT NOT NULL DEFAULT 'ROOM_LEVEL';
ALTER TABLE "Property" ADD COLUMN "monthlyRent" REAL;
ALTER TABLE "Property" ADD COLUMN "totalRoomCount" INTEGER;
ALTER TABLE "Property" ADD COLUMN "bedroomCount" INTEGER;
ALTER TABLE "Property" ADD COLUMN "bathroomCount" INTEGER;
ALTER TABLE "Property" ADD COLUMN "surfaceAreaSqm" REAL;
ALTER TABLE "Property" ADD COLUMN "hasTerrace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "hasBalcony" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "hasGarden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "hasParking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "isFurnished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "description" TEXT;

ALTER TABLE "Room" ADD COLUMN "isDefaultWholePropertyRoom" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Room_one_default_whole_property_room_per_property"
ON "Room"("propertyId")
WHERE "isDefaultWholePropertyRoom" = true;
