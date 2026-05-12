"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/currentUser";
import prisma from "@/lib/prisma";
import { OccupancySchema } from "@/lib/validations";
import {
  getPaymentDueDate,
  listPaymentPeriodsForOccupancy,
  periodKey,
  toBillingDate,
  type PaymentPeriod,
} from "@/lib/occupancyPayments";

async function requireAuth() {
  return requireUser();
}

function periodIsBefore(a: PaymentPeriod, b: PaymentPeriod) {
  return a.year < b.year || (a.year === b.year && a.month < b.month);
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
    paymentGracePeriodDays: formData.get("paymentGracePeriodDays") || 5,
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") || undefined,
  });

  // Prevent assigning to an already-occupied room or a tenant with an active lease
  const [roomForUser, tenantForUser, occupiedRoom, activeTenantLease] = await Promise.all([
    prisma.room.findFirst({ where: { id: validated.roomId, userId: user.id }, select: { id: true } }),
    prisma.tenant.findFirst({ where: { id: validated.tenantId, userId: user.id }, select: { id: true } }),
    prisma.occupancy.findFirst({ where: { roomId: validated.roomId, status: "ACTIVE", userId: user.id } }),
    prisma.occupancy.findFirst({ where: { tenantId: validated.tenantId, status: "ACTIVE", userId: user.id } }),
  ]);
  if (!roomForUser) throw new Error("Room not found.");
  if (!tenantForUser) throw new Error("Tenant not found.");
  if (occupiedRoom) throw new Error("This room already has an active tenant.");
  if (activeTenantLease) throw new Error("This tenant already has an active lease.");

  const leaseStart = toBillingDate(validated.leaseStart);
  const moveInDate = validated.moveInDate ? toBillingDate(validated.moveInDate) : null;

  const occupancy = await prisma.occupancy.create({
    data: {
      userId: user.id,
      roomId: validated.roomId,
      tenantId: validated.tenantId,
      leaseStart,
      leaseEnd: validated.leaseEnd ? new Date(validated.leaseEnd) : null,
      moveInDate,
      moveOutDate: validated.moveOutDate ? new Date(validated.moveOutDate) : null,
      monthlyRent: validated.monthlyRent,
      depositRequired: validated.depositRequired,
      rentDueDay: validated.rentDueDay,
      paymentGracePeriodDays: validated.paymentGracePeriodDays,
      status: validated.status,
      notes: validated.notes || null,
    },
  });

  // Create the deposit record
  await prisma.deposit.create({
    data: {
      occupancyId: occupancy.id,
      userId: user.id,
      required: validated.depositRequired,
    },
  });

  // Set room status to OCCUPIED
  await prisma.room.update({
    where: { id: validated.roomId, userId: user.id },
    data: { status: "OCCUPIED" },
  });

  const room = await prisma.room.findUnique({
    where: { id: validated.roomId, userId: user.id },
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

  // Generate payment records from the lease start, plus one upcoming period for
  // already-started tenancies so early payments can target the next rent month.
  const periods = listPaymentPeriodsForOccupancy({ leaseStart });
  const payments = periods.map((period) => ({
    userId: user.id,
    occupancyId: occupancy.id,
    periodYear: period.year,
    periodMonth: period.month,
    amountDue: validated.monthlyRent,
    dueDate: getPaymentDueDate({
      leaseStart,
      period,
      rentDueDay: validated.rentDueDay,
      paymentGracePeriodDays: validated.paymentGracePeriodDays,
    }),
    status: "UNPAID",
  }));

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
    where: { id: occupancyId, userId: user.id },
    data: {
      status: "ENDED",
      moveOutDate,
    },
    include: { room: true, deposit: true },
  });

  // Set deposit refund due date when tenancy ends
  if (occupancy.deposit && !occupancy.deposit.refunded) {
    await prisma.deposit.update({
      where: { id: occupancy.deposit.id, userId: user.id },
      data: { refundDueDate },
    });
  }

  // Set room back to VACANT
  await prisma.room.update({
    where: { id: occupancy.roomId, userId: user.id },
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
  const user = await requireAuth();

  const occupancy = await prisma.occupancy.findUnique({
    where: { id: occupancyId, userId: user.id },
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
    paymentGracePeriodDays: formData.get("paymentGracePeriodDays") ?? occupancy.paymentGracePeriodDays,
    status: occupancy.status,
    notes: formData.get("notes") || undefined,
  });

  const newLeaseStart = toBillingDate(validated.leaseStart);
  const newMoveIn = validated.moveInDate ? toBillingDate(validated.moveInDate) : null;

  const targetPeriods = listPaymentPeriodsForOccupancy({
    leaseStart: newLeaseStart,
  });
  const targetKeys = new Set(targetPeriods.map(periodKey));
  const firstTarget = targetPeriods[0];

  // Existing payments outside the new target window are candidates for removal.
  const removablePayments = occupancy.payments.filter((payment) => {
    const key = `${payment.periodYear}-${payment.periodMonth}`;
    return !targetKeys.has(key);
  });

  // Any removable payment that already has recorded activity is locked — editing
  // would silently delete that history, so block the update with a clear error.
  const lockedPayments = removablePayments.filter(
    (payment) => payment.amountPaid > 0 || !["UNPAID", "OVERDUE"].includes(payment.status),
  );

  if (lockedPayments.length > 0) {
    // Keep the error message focused on the most common cause: moving lease start
    // past an existing paid period.
    const hasShiftedForward = firstTarget
      ? occupancy.payments.some((p) =>
          periodIsBefore({ year: p.periodYear, month: p.periodMonth }, firstTarget),
        )
      : false;
    throw new Error(
      hasShiftedForward
        ? "Lease start cannot be moved after an existing payment period that already has payment activity."
        : "This change would remove a payment period that already has recorded activity.",
    );
  }

  const existingKeys = new Set(
    occupancy.payments.map((payment) => `${payment.periodYear}-${payment.periodMonth}`),
  );
  const paymentsToCreate = targetPeriods
    .filter((period) => !existingKeys.has(periodKey(period)))
    .map((period) => ({
      userId: user.id,
      occupancyId,
      periodYear: period.year,
      periodMonth: period.month,
      amountDue: occupancy.monthlyRent,
      dueDate: getPaymentDueDate({
        leaseStart: newLeaseStart,
        period,
        rentDueDay: occupancy.rentDueDay,
        paymentGracePeriodDays: validated.paymentGracePeriodDays,
      }),
      status: "UNPAID" as const,
    }));

  await prisma.$transaction(async (tx) => {
    await tx.occupancy.update({
      where: { id: occupancyId, userId: user.id },
      data: {
        leaseStart: newLeaseStart,
        leaseEnd: validated.leaseEnd ? new Date(validated.leaseEnd) : null,
        moveInDate: newMoveIn,
        paymentGracePeriodDays: validated.paymentGracePeriodDays,
        notes: validated.notes || null,
      },
    });

    if (removablePayments.length > 0) {
      await tx.payment.deleteMany({
        where: {
          userId: user.id,
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

    const targetPeriodMap = new Map(targetPeriods.map((period) => [periodKey(period), period]));
    await Promise.all(
      occupancy.payments
        .filter((payment) => targetPeriodMap.has(`${payment.periodYear}-${payment.periodMonth}`))
        .map((payment) => {
          const period = targetPeriodMap.get(`${payment.periodYear}-${payment.periodMonth}`);
          if (!period) return Promise.resolve();

          return tx.payment.update({
            where: { id: payment.id, userId: user.id },
            data: {
              dueDate: getPaymentDueDate({
                leaseStart: newLeaseStart,
                period,
                rentDueDay: occupancy.rentDueDay,
                paymentGracePeriodDays: validated.paymentGracePeriodDays,
              }),
            },
          });
        }),
    );
  });

  revalidatePath(`/rooms/${occupancy.roomId}`);
  revalidatePath(`/tenants/${occupancy.tenantId}`);
  redirect(`/rooms/${occupancy.roomId}`);
}
