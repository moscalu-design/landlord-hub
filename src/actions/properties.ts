"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/currentUser";
import prisma from "@/lib/prisma";
import { PropertySchema, type PropertyInput } from "@/lib/validations";
import { z } from "zod";

export type PropertyActionState = {
  error: string | null;
};

const WHOLE_PROPERTY_ROOM_NAME = "Whole property";

async function requireAuth() {
  return requireUser();
}

function getPropertyValidationMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Check the property details and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function readBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  if (value == null) return false;
  return value === "true" || value === "on" || value === "1";
}

function parsePropertyForm(formData: FormData): PropertyInput {
  return PropertySchema.parse({
    name: formData.get("name"),
    address: formData.get("address"),
    city: formData.get("city"),
    postcode: formData.get("postcode") || undefined,
    country: formData.get("country") || "UK",
    propertyType: formData.get("propertyType") || "HOUSE",
    status: formData.get("status") || "ACTIVE",
    rentalMode: formData.get("rentalMode") || "ROOM_LEVEL",
    monthlyRent: formData.get("monthlyRent"),
    totalRoomCount: formData.get("totalRoomCount"),
    bedroomCount: formData.get("bedroomCount"),
    bathroomCount: formData.get("bathroomCount"),
    surfaceAreaSqm: formData.get("surfaceAreaSqm"),
    hasTerrace: readBoolean(formData, "hasTerrace"),
    hasBalcony: readBoolean(formData, "hasBalcony"),
    hasGarden: readBoolean(formData, "hasGarden"),
    hasParking: readBoolean(formData, "hasParking"),
    isFurnished: readBoolean(formData, "isFurnished"),
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

function propertyDataFromValidated(validated: PropertyInput) {
  return {
    name: validated.name,
    address: validated.address,
    city: validated.city,
    country: validated.country,
    propertyType: validated.propertyType,
    status: validated.status,
    rentalMode: validated.rentalMode,
    monthlyRent: validated.rentalMode === "FULL_PROPERTY" ? validated.monthlyRent ?? null : null,
    totalRoomCount: validated.totalRoomCount,
    bedroomCount: validated.bedroomCount,
    bathroomCount: validated.bathroomCount,
    surfaceAreaSqm: validated.surfaceAreaSqm,
    hasTerrace: validated.hasTerrace,
    hasBalcony: validated.hasBalcony,
    hasGarden: validated.hasGarden,
    hasParking: validated.hasParking,
    isFurnished: validated.isFurnished,
    description: validated.description ? String(validated.description) : null,
    notes: validated.notes ? String(validated.notes) : null,
    postcode: validated.postcode ? String(validated.postcode) : null,
  };
}

// Ensures a single hidden Room exists for FULL_PROPERTY properties and that its
// rent stays in sync with the property-level monthlyRent. Safe to call on every
// edit — it never duplicates and never touches user-created rooms.
async function ensureWholePropertyRoom(args: {
  userId: string;
  propertyId: string;
  monthlyRent: number;
}) {
  const existing = await prisma.room.findFirst({
    where: {
      propertyId: args.propertyId,
      userId: args.userId,
      isDefaultWholePropertyRoom: true,
    },
    include: { occupancies: { where: { status: "ACTIVE" }, select: { id: true } } },
  });

  if (existing) {
    const hasActive = existing.occupancies.length > 0;
    await prisma.room.update({
      where: { id: existing.id, userId: args.userId },
      data: {
        monthlyRent: args.monthlyRent,
        depositAmount: existing.depositAmount || args.monthlyRent,
        status: hasActive ? "OCCUPIED" : "VACANT",
      },
    });
    return existing.id;
  }

  const room = await prisma.room.create({
    data: {
      userId: args.userId,
      propertyId: args.propertyId,
      name: WHOLE_PROPERTY_ROOM_NAME,
      monthlyRent: args.monthlyRent,
      depositAmount: args.monthlyRent,
      furnished: false,
      isDefaultWholePropertyRoom: true,
      status: "VACANT",
    },
  });
  return room.id;
}

export async function createProperty(formData: FormData) {
  const user = await requireAuth();
  const validated = parsePropertyForm(formData);

  const property = await prisma.property.create({
    data: {
      userId: user.id,
      ...propertyDataFromValidated(validated),
    },
  });

  if (validated.rentalMode === "FULL_PROPERTY" && validated.monthlyRent != null) {
    await ensureWholePropertyRoom({
      userId: user.id,
      propertyId: property.id,
      monthlyRent: validated.monthlyRent,
    });
  }

  await prisma.activityLog.create({
    data: {
      action: "PROPERTY_CREATED",
      description: `Property "${property.name}" created`,
      entityType: "PROPERTY",
      entityId: property.id,
      userId: user.id,
      propertyId: property.id,
    },
  });

  revalidatePath("/properties");
  redirect(`/properties/${property.id}`);
}

export async function createPropertyFromState(
  _prevState: PropertyActionState,
  formData: FormData
): Promise<PropertyActionState> {
  try {
    await createProperty(formData);
  } catch (error) {
    unstable_rethrow(error);
    return { error: getPropertyValidationMessage(error) };
  }
  return { error: null };
}

export async function updateProperty(id: string, formData: FormData) {
  const user = await requireAuth();
  const validated = parsePropertyForm(formData);

  const existing = await prisma.property.findUnique({
    where: { id, userId: user.id },
    select: { id: true, rentalMode: true },
  });
  if (!existing) throw new Error("Property not found.");

  // Mode-switch safety. Keep switching conservative: only allow it when the
  // current mode has no user-managed rental units or tenancy/payment history
  // that would become hidden after the switch.
  if (existing.rentalMode !== validated.rentalMode) {
    if (existing.rentalMode === "ROOM_LEVEL" && validated.rentalMode === "FULL_PROPERTY") {
      const visibleRoom = await prisma.room.findFirst({
        where: {
          userId: user.id,
          propertyId: id,
          isDefaultWholePropertyRoom: false,
        },
        select: { id: true },
      });
      if (visibleRoom) {
        throw new Error(
          "Cannot switch to whole-property rental while individual room records exist."
        );
      }

      const roomOccupancy = await prisma.occupancy.findFirst({
        where: {
          userId: user.id,
          room: { propertyId: id, isDefaultWholePropertyRoom: false },
        },
        select: { id: true },
      });
      if (roomOccupancy) {
        throw new Error(
          "Cannot switch to whole-property rental while individual rooms have tenancy or payment history."
        );
      }
    } else if (existing.rentalMode === "FULL_PROPERTY" && validated.rentalMode === "ROOM_LEVEL") {
      const wholePropertyOccupancy = await prisma.occupancy.findFirst({
        where: {
          userId: user.id,
          room: { propertyId: id, isDefaultWholePropertyRoom: true },
        },
        select: { id: true },
      });
      if (wholePropertyOccupancy) {
        throw new Error(
          "Cannot switch to room-level rental while the whole-property unit has tenancy or payment history."
        );
      }
    }
  }

  await prisma.property.update({
    where: { id, userId: user.id },
    data: propertyDataFromValidated(validated),
  });

  if (validated.rentalMode === "FULL_PROPERTY" && validated.monthlyRent != null) {
    await ensureWholePropertyRoom({
      userId: user.id,
      propertyId: id,
      monthlyRent: validated.monthlyRent,
    });
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  redirect(`/properties/${id}`);
}

export async function updatePropertyFromState(
  id: string,
  _prevState: PropertyActionState,
  formData: FormData
): Promise<PropertyActionState> {
  try {
    await updateProperty(id, formData);
  } catch (error) {
    unstable_rethrow(error);
    return { error: getPropertyValidationMessage(error) };
  }
  return { error: null };
}

export async function archiveProperty(id: string) {
  const user = await requireAuth();
  await prisma.property.update({ where: { id, userId: user.id }, data: { status: "ARCHIVED" } });
  revalidatePath("/properties");
  redirect("/properties");
}
