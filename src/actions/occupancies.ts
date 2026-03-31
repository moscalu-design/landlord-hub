"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { OccupancySchema } from "@/lib/validations";
import { getDueDate } from "@/lib/utils";

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function createOccupancy(formData: FormData) {
  const user = await requireAuth();
  const validated = OccupancySchema.parse({
    roomId: formData.get("roomId"),
    tenantId: formData.get("tenantId"),
    leaseStart: formData.get("leaseStart"),
    leaseEnd: formData.get("leaseEnd") || undefined,
    moveInDate: formData.get("moveInDate") || undefined,
    moveOutDate: formData.get("moveOutDate") || undefined,
    monthlyRent: formData.get("monthlyRent"),
    depositRequired: formData.get("depositRequired"),
    rentDueDay: formData.get("rentDueDay") || 1,
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });

  // Prevent assigning to an already-occupied room or a tenant with an active lease
  const [occupiedRoom, activeTenantLease] = await Promise.all([
    prisma.occupancy.findFirst({ where: { roomId: validated.roomId, status: "ACTIVE" } }),
    prisma.occupancy.findFirst({ where: { tenantId: validated.tenantId, status: "ACTIVE" } }),
  ]);
  if (occupiedRoom) throw new Error("This room already has an active tenant.");
  if (activeTenantLease) throw new Error("This tenant already has an active lease.");

  const occupancy = await prisma.occupancy.create({
    data: {
      roomId: validated.roomId,
      tenantId: validated.tenantId,
      leaseStart: new Date(validated.leaseStart),
      leaseEnd: validated.leaseEnd ? new Date(validated.leaseEnd) : null,
      moveInDate: validated.moveInDate ? new Date(validated.moveInDate) : null,
      moveOutDate: validated.moveOutDate ? new Date(validated.moveOutDate) : null,
      monthlyRent: validated.monthlyRent,
      depositRequired: validated.depositRequired,
      rentDueDay: validated.rentDueDay,
      status: validated.status,
      notes: validated.notes || null,
    },
  });

  // Create the deposit record
  await prisma.deposit.create({
    data: {
      occupancyId: occupancy.id,
      required: validated.depositRequired,
    },
  });

  // Set room status to OCCUPIED
  await prisma.room.update({
    where: { id: validated.roomId },
    data: { status: "OCCUPIED" },
  });

  const room = await prisma.room.findUnique({
    where: { id: validated.roomId },
    include: { property: true },
  });

  await prisma.activityLog.create({
    data: {
      action: "TENANT_ASSIGNED",
      description: `Tenant assigned to room "${room?.name}"`,
      entityType: "OCCUPANCY",
      entityId: occupancy.id,
      userId: user.id,
      propertyId: room?.propertyId,
      roomId: validated.roomId,
      tenantId: validated.tenantId,
      occupancyId: occupancy.id,
    },
  });

  // Backfill payments from lease start to current month
  const leaseStart = new Date(validated.leaseStart);
  const now = new Date();
  const payments = [];
  let year = leaseStart.getFullYear();
  let month = leaseStart.getMonth() + 1;

  while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1)) {
    payments.push({
      occupancyId: occupancy.id,
      periodYear: year,
      periodMonth: month,
      amountDue: validated.monthlyRent,
      dueDate: getDueDate(year, month, validated.rentDueDay),
      status: "UNPAID",
    });

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  if (payments.length > 0) {
    await prisma.payment.createMany({ data: payments });
  }

  revalidatePath(`/rooms/${validated.roomId}`);
  revalidatePath(`/tenants/${validated.tenantId}`);
  redirect(`/rooms/${validated.roomId}`);
}

export async function endOccupancy(occupancyId: string, _formData?: FormData) {
  const user = await requireAuth();

  const occupancy = await prisma.occupancy.update({
    where: { id: occupancyId },
    data: {
      status: "ENDED",
      moveOutDate: new Date(),
    },
    include: { room: true },
  });

  // Set room back to VACANT
  await prisma.room.update({
    where: { id: occupancy.roomId },
    data: { status: "VACANT" },
  });

  await prisma.activityLog.create({
    data: {
      action: "TENANT_MOVED_OUT",
      description: `Tenant moved out of room "${occupancy.room.name}"`,
      entityType: "OCCUPANCY",
      entityId: occupancyId,
      userId: user.id,
      roomId: occupancy.roomId,
      tenantId: occupancy.tenantId,
      occupancyId,
    },
  });

  revalidatePath(`/rooms/${occupancy.roomId}`);
  revalidatePath(`/tenants/${occupancy.tenantId}`);
  redirect(`/rooms/${occupancy.roomId}`);
}
