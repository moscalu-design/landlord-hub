"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/currentUser";
import prisma from "@/lib/prisma";
import { RoomSchema } from "@/lib/validations";
import { z } from "zod";

export type RoomActionState = {
  error: string | null;
};

async function requireAuth() {
  return requireUser();
}

function getRoomValidationMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Check the room details and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function parseRoomFormData(formData: FormData) {
  return RoomSchema.parse({
    name: formData.get("name"),
    floor: formData.get("floor") || undefined,
    sizeM2: formData.get("sizeM2") || undefined,
    furnished: formData.get("furnished") === "true",
    monthlyRent: formData.get("monthlyRent"),
    depositAmount: formData.get("depositAmount"),
    status: formData.get("status") || "VACANT",
    notes: formData.get("notes") || undefined,
  });
}

export async function createRoom(propertyId: string, formData: FormData): Promise<never> {
  const user = await requireAuth();
  const validated = parseRoomFormData(formData);
  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: user.id },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found.");

  const room = await prisma.room.create({
    data: {
      userId: user.id,
      ...validated,
      propertyId,
      floor: validated.floor || null,
      notes: validated.notes || null,
      sizeM2: validated.sizeM2 ?? null,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: "ROOM_ADDED",
      description: `Room "${room.name}" added to property`,
      entityType: "ROOM",
      entityId: room.id,
      userId: user.id,
      propertyId,
      roomId: room.id,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  redirect(`/rooms/${room.id}`);
}

export async function createRoomFromState(
  propertyId: string,
  _prevState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  try {
    await createRoom(propertyId, formData);
  } catch (error) {
    unstable_rethrow(error);
    return { error: getRoomValidationMessage(error) };
  }
  return { error: null };
}

export async function updateRoom(id: string, propertyId: string, formData: FormData): Promise<never> {
  const user = await requireAuth();
  const validated = parseRoomFormData(formData);

  await prisma.room.update({
    where: { id, userId: user.id },
    data: {
      name: validated.name,
      floor: validated.floor || null,
      sizeM2: validated.sizeM2 ?? null,
      furnished: validated.furnished,
      monthlyRent: validated.monthlyRent,
      depositAmount: validated.depositAmount,
      status: validated.status,
      notes: validated.notes || null,
    },
  });

  revalidatePath(`/rooms/${id}`);
  revalidatePath(`/properties/${propertyId}`);
  redirect(`/rooms/${id}`);
}

export async function updateRoomFromState(
  id: string,
  propertyId: string,
  _prevState: RoomActionState,
  formData: FormData
): Promise<RoomActionState> {
  try {
    await updateRoom(id, propertyId, formData);
  } catch (error) {
    unstable_rethrow(error);
    return { error: getRoomValidationMessage(error) };
  }
  return { error: null };
}

export async function deleteRoom(id: string, propertyId: string) {
  const user = await requireAuth();

  const activeOccupancy = await prisma.occupancy.findFirst({
    where: { roomId: id, status: "ACTIVE", userId: user.id },
    select: { id: true },
  });

  if (activeOccupancy) {
    throw new Error("Cannot delete a room with an active tenancy.");
  }

  await prisma.room.delete({ where: { id, userId: user.id } });

  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  redirect(`/properties/${propertyId}`);
}
