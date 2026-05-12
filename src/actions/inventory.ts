"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/currentUser";
import { deleteStoredDocument } from "@/lib/documentStorage";
import prisma from "@/lib/prisma";
import {
  InventoryItemSchema,
  InventoryInspectionSchema,
  InventoryInspectionItemSchema,
} from "@/lib/validations";
import { z } from "zod";

async function requireAuth() {
  return requireUser();
}

async function revalidateInventorySurfaces(roomId: string, userId: string) {
  revalidatePath(`/rooms/${roomId}/inventory`);
  const room = await prisma.room.findFirst({
    where: { id: roomId, userId },
    select: { propertyId: true, isDefaultWholePropertyRoom: true },
  });
  if (room?.isDefaultWholePropertyRoom) {
    revalidatePath(`/properties/${room.propertyId}`);
    revalidatePath(`/properties/${room.propertyId}/payments`);
  }
}

// ─── Room Inventory Items ──────────────────────────────────────────────────────

export async function createInventoryItem(
  roomId: string,
  formData: FormData
): Promise<{ id: string }> {
  const user = await requireAuth();
  const room = await prisma.room.findFirst({ where: { id: roomId, userId: user.id }, select: { id: true } });
  if (!room) throw new Error("Room not found.");

  const validated = InventoryItemSchema.parse({
    name: formData.get("name"),
    category: formData.get("category") || "FURNITURE",
    quantity: formData.get("quantity") || 1,
    estimatedValue: formData.get("estimatedValue") || null,
    notes: formData.get("notes") || undefined,
    sortOrder: formData.get("sortOrder") || 0,
  });

  const item = await prisma.roomInventoryItem.create({
    data: {
      userId: user.id,
      roomId,
      name: validated.name,
      category: validated.category,
      quantity: validated.quantity,
      estimatedValue: validated.estimatedValue ?? null,
      notes: validated.notes || null,
      sortOrder: validated.sortOrder,
    },
  });

  await revalidateInventorySurfaces(roomId, user.id);
  return { id: item.id };
}

export async function updateInventoryItem(
  id: string,
  roomId: string,
  formData: FormData
): Promise<void> {
  const user = await requireAuth();

  const validated = InventoryItemSchema.parse({
    name: formData.get("name"),
    category: formData.get("category") || "FURNITURE",
    quantity: formData.get("quantity") || 1,
    estimatedValue: formData.get("estimatedValue") || null,
    notes: formData.get("notes") || undefined,
    sortOrder: formData.get("sortOrder") || 0,
  });

  await prisma.roomInventoryItem.update({
    where: { id, roomId, userId: user.id },
    data: {
      name: validated.name,
      category: validated.category,
      quantity: validated.quantity,
      estimatedValue: validated.estimatedValue ?? null,
      notes: validated.notes || null,
      sortOrder: validated.sortOrder,
    },
  });

  await revalidateInventorySurfaces(roomId, user.id);
}

export async function deleteInventoryItem(id: string, roomId: string): Promise<void> {
  const user = await requireAuth();
  await prisma.roomInventoryItem.delete({ where: { id, roomId, userId: user.id } });
  await revalidateInventorySurfaces(roomId, user.id);
}

// ─── Inventory Inspections ─────────────────────────────────────────────────────

const InspectionWithItemsSchema = z.object({
  inspection: InventoryInspectionSchema,
  items: z.array(InventoryInspectionItemSchema),
});

export async function createInspection(
  occupancyId: string,
  roomId: string,
  data: z.infer<typeof InspectionWithItemsSchema>
): Promise<{
  id: string;
  items: { id: string; inventoryItemId: string | null }[];
}> {
  const user = await requireAuth();

  const validated = InspectionWithItemsSchema.parse(data);
  const occupancy = await prisma.occupancy.findUnique({
    where: { id: occupancyId, userId: user.id },
    select: {
      roomId: true,
      inspections: {
        where: { type: validated.inspection.type },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!occupancy || occupancy.roomId !== roomId) {
    throw new Error("Occupancy does not belong to this room.");
  }

  if (occupancy.inspections.length > 0) {
    throw new Error("This inspection type has already been recorded for the tenancy.");
  }

  const requestedItemIds = validated.items.map((item) => item.inventoryItemId);
  const roomItems = await prisma.roomInventoryItem.findMany({
    where: { roomId, userId: user.id, id: { in: requestedItemIds } },
    select: { id: true, name: true, quantity: true },
  });
  const roomItemById = new Map(roomItems.map((item) => [item.id, item]));

  if (roomItems.length !== requestedItemIds.length) {
    throw new Error("Inspection contains inventory items that do not belong to this room.");
  }

  const inspection = await prisma.inventoryInspection.create({
    data: {
      userId: user.id,
      occupancyId,
      type: validated.inspection.type,
      date: new Date(validated.inspection.date),
      notes: validated.inspection.notes || null,
      items: {
        create: validated.items.map((item) => {
          const roomItem = roomItemById.get(item.inventoryItemId);
          if (!roomItem) {
            throw new Error("Inspection contains an unknown inventory item.");
          }

          return {
            inventoryItemId: item.inventoryItemId,
            userId: user.id,
            itemName: roomItem.name,
            condition: item.condition,
            quantity: item.quantity,
            notes: item.notes || null,
          };
        }),
      },
    },
    include: {
      items: { select: { id: true, inventoryItemId: true } },
    },
  });

  await revalidateInventorySurfaces(roomId, user.id);
  return {
    id: inspection.id,
    items: inspection.items.map((i) => ({
      id: i.id,
      inventoryItemId: i.inventoryItemId,
    })),
  };
}

export async function deleteInspection(
  id: string,
  roomId: string
): Promise<void> {
  const user = await requireAuth();
  const inspection = await prisma.inventoryInspection.findUnique({
    where: { id, userId: user.id },
    include: { photos: true },
  });

  if (!inspection) {
    return;
  }

  for (const photo of inspection.photos) {
    try {
      await deleteStoredDocument(photo.storageUrl);
    } catch {
      // Best-effort — continue deleting the inspection record
    }
  }

  await prisma.inventoryInspection.delete({ where: { id, userId: user.id } });
  await revalidateInventorySurfaces(roomId, user.id);
}
