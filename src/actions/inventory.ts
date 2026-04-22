"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  InventoryItemSchema,
  InventoryInspectionSchema,
  InventoryInspectionItemSchema,
} from "@/lib/validations";
import { z } from "zod";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

// ─── Room Inventory Items ──────────────────────────────────────────────────────

export async function createInventoryItem(
  roomId: string,
  formData: FormData
): Promise<{ id: string }> {
  await requireAuth();

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
      roomId,
      name: validated.name,
      category: validated.category,
      quantity: validated.quantity,
      estimatedValue: validated.estimatedValue ?? null,
      notes: validated.notes || null,
      sortOrder: validated.sortOrder,
    },
  });

  revalidatePath(`/rooms/${roomId}/inventory`);
  return { id: item.id };
}

export async function updateInventoryItem(
  id: string,
  roomId: string,
  formData: FormData
): Promise<void> {
  await requireAuth();

  const validated = InventoryItemSchema.parse({
    name: formData.get("name"),
    category: formData.get("category") || "FURNITURE",
    quantity: formData.get("quantity") || 1,
    estimatedValue: formData.get("estimatedValue") || null,
    notes: formData.get("notes") || undefined,
    sortOrder: formData.get("sortOrder") || 0,
  });

  await prisma.roomInventoryItem.update({
    where: { id, roomId },
    data: {
      name: validated.name,
      category: validated.category,
      quantity: validated.quantity,
      estimatedValue: validated.estimatedValue ?? null,
      notes: validated.notes || null,
      sortOrder: validated.sortOrder,
    },
  });

  revalidatePath(`/rooms/${roomId}/inventory`);
}

export async function deleteInventoryItem(id: string, roomId: string): Promise<void> {
  await requireAuth();
  await prisma.roomInventoryItem.delete({ where: { id, roomId } });
  revalidatePath(`/rooms/${roomId}/inventory`);
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
): Promise<{ id: string }> {
  await requireAuth();

  const validated = InspectionWithItemsSchema.parse(data);
  const occupancy = await prisma.occupancy.findUnique({
    where: { id: occupancyId },
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
    where: { roomId, id: { in: requestedItemIds } },
    select: { id: true, name: true, quantity: true },
  });
  const roomItemById = new Map(roomItems.map((item) => [item.id, item]));

  if (roomItems.length !== requestedItemIds.length) {
    throw new Error("Inspection contains inventory items that do not belong to this room.");
  }

  const inspection = await prisma.inventoryInspection.create({
    data: {
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
            itemName: roomItem.name,
            condition: item.condition,
            quantity: item.quantity,
            notes: item.notes || null,
          };
        }),
      },
    },
  });

  revalidatePath(`/rooms/${roomId}/inventory`);
  return { id: inspection.id };
}

export async function deleteInspection(
  id: string,
  roomId: string
): Promise<void> {
  await requireAuth();
  await prisma.inventoryInspection.delete({ where: { id } });
  revalidatePath(`/rooms/${roomId}/inventory`);
}
