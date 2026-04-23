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

function getMonthKey(date: Date) {
  return date.getFullYear() * 100 + date.getMonth() + 1;
}

function listPaymentPeriods(from: Date, to: Date) {
  const periods: Array<{ year: number; month: number }> = [];
  let year = from.getFullYear();
  let month = from.getMonth() + 1;

  while (year < to.getFullYear() || (year === to.getFullYear() && month <= to.getMonth() + 1)) {
    periods.push({ year, month });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return periods;
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

export async function endOccupancy(occupancyId: string, formData?: FormData) {
  const user = await requireAuth();

  const rawDate = formData?.get("moveOutDate");
  const moveOutDate =
    rawDate && typeof rawDate === "string" && rawDate.length > 0
      ? new Date(rawDate)
      : new Date();
  const refundDueDate = new Date(moveOutDate);
  refundDueDate.setDate(refundDueDate.getDate() + 30);

  const occupancy = await prisma.occupancy.update({
    where: { id: occupancyId },
    data: {
      status: "ENDED",
      moveOutDate,
    },
    include: { room: true, deposit: true },
  });

  // Set deposit refund due date when tenancy ends
  if (occupancy.deposit && !occupancy.deposit.refunded) {
    await prisma.deposit.update({
      where: { id: occupancy.deposit.id },
      data: { refundDueDate },
    });
  }

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

export async function updateOccupancy(occupancyId: string, formData: FormData) {
  await requireAuth();

  const occupancy = await prisma.occupancy.findUnique({
    where: { id: occupancyId },
    include: {
      payments: {
        orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
      },
    },
  });

  if (!occupancy) {
    throw new Error("Tenancy not found.");
  }

  if (occupancy.status !== "ACTIVE") {
    throw new Error("Only active tenancies can be edited.");
  }

  const validated = OccupancySchema.parse({
    roomId: occupancy.roomId,
    tenantId: occupancy.tenantId,
    leaseStart: formData.get("leaseStart"),
    leaseEnd: formData.get("leaseEnd") || undefined,
    moveInDate: formData.get("moveInDate") || undefined,
    moveOutDate: occupancy.moveOutDate ? occupancy.moveOutDate.toISOString() : undefined,
    monthlyRent: occupancy.monthlyRent,
    depositRequired: occupancy.depositRequired,
    rentDueDay: occupancy.rentDueDay,
    status: occupancy.status,
    notes: formData.get("notes") || undefined,
  });

  const newLeaseStart = new Date(validated.leaseStart);
  const newLeaseStartKey = getMonthKey(newLeaseStart);
  const removablePayments = occupancy.payments.filter(
    (payment) => payment.periodYear * 100 + payment.periodMonth < newLeaseStartKey
  );

  const lockedPayments = removablePayments.filter(
    (payment) => payment.amountPaid > 0 || !["UNPAID", "OVERDUE"].includes(payment.status)
  );

  if (lockedPayments.length > 0) {
    throw new Error(
      "Lease start cannot be moved after an existing payment period that already has payment activity."
    );
  }

  const now = new Date();
  const targetPeriods = listPaymentPeriods(newLeaseStart, now);
  const existingKeys = new Set(
    occupancy.payments.map((payment) => `${payment.periodYear}-${payment.periodMonth}`)
  );
  const paymentsToCreate = targetPeriods
    .filter((period) => !existingKeys.has(`${period.year}-${period.month}`))
    .map((period) => ({
      occupancyId,
      periodYear: period.year,
      periodMonth: period.month,
      amountDue: occupancy.monthlyRent,
      dueDate: getDueDate(period.year, period.month, occupancy.rentDueDay),
      status: "UNPAID" as const,
    }));

  await prisma.$transaction(async (tx) => {
    await tx.occupancy.update({
      where: { id: occupancyId },
      data: {
        leaseStart: newLeaseStart,
        leaseEnd: validated.leaseEnd ? new Date(validated.leaseEnd) : null,
        moveInDate: validated.moveInDate ? new Date(validated.moveInDate) : null,
        notes: validated.notes || null,
      },
    });

    if (removablePayments.length > 0) {
      await tx.payment.deleteMany({
        where: {
          id: {
            in: removablePayments.map((payment) => payment.id),
          },
        },
      });
    }

    if (paymentsToCreate.length > 0) {
      await tx.payment.createMany({
        data: paymentsToCreate,
      });
    }
  });

  revalidatePath(`/rooms/${occupancy.roomId}`);
  revalidatePath(`/tenants/${occupancy.tenantId}`);
  redirect(`/rooms/${occupancy.roomId}`);
}
