import prisma from "@/lib/prisma";
import {
  getPaymentDueDate,
  listPaymentPeriodsForOccupancy,
} from "@/lib/occupancyPayments";
import { computePaymentStatus } from "@/lib/utils";

type EnsureRentPaymentsOptions = {
  userId: string;
  propertyId?: string;
  now?: Date;
};

export type EnsureRentPaymentsResult = {
  created: number;
  updated: number;
};

function paymentStatusForPersistence(payment: {
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: Date;
}, now: Date) {
  return computePaymentStatus({ ...payment, asOf: now });
}

export async function ensureRentPaymentsForUser({
  userId,
  propertyId,
  now = new Date(),
}: EnsureRentPaymentsOptions): Promise<EnsureRentPaymentsResult> {
  const occupancies = await prisma.occupancy.findMany({
    where: {
      userId,
      status: "ACTIVE",
      ...(propertyId ? { room: { propertyId, userId } } : {}),
    },
    include: {
      payments: true,
      room: { select: { propertyId: true } },
    },
  });

  let created = 0;
  let updated = 0;

  for (const occupancy of occupancies) {
    const periods = listPaymentPeriodsForOccupancy({
      leaseStart: occupancy.leaseStart,
      now,
    });
    const existingByPeriod = new Map(
      occupancy.payments.map((payment) => [
        `${payment.periodYear}-${payment.periodMonth}`,
        payment,
      ])
    );

    for (const period of periods) {
      const dueDate = getPaymentDueDate({
        leaseStart: occupancy.leaseStart,
        period,
        rentDueDay: occupancy.rentDueDay,
        paymentGracePeriodDays: occupancy.paymentGracePeriodDays,
      });
      const existing = existingByPeriod.get(`${period.year}-${period.month}`);

      if (!existing) {
        await prisma.payment.create({
          data: {
            userId,
            occupancyId: occupancy.id,
            periodYear: period.year,
            periodMonth: period.month,
            amountDue: occupancy.monthlyRent,
            dueDate,
            status: paymentStatusForPersistence({
              amountDue: occupancy.monthlyRent,
              amountPaid: 0,
              status: "UNPAID",
              dueDate,
            }, now),
          },
        });
        created++;
        continue;
      }

      const nextStatus = paymentStatusForPersistence({
        amountDue: occupancy.monthlyRent,
        amountPaid: existing.amountPaid,
        status: existing.status,
        dueDate,
      }, now);
      const dueDateChanged = existing.dueDate.getTime() !== dueDate.getTime();
      const amountChanged = existing.amountDue !== occupancy.monthlyRent;
      const statusChanged = existing.status !== nextStatus;

      if (dueDateChanged || amountChanged || statusChanged) {
        await prisma.payment.update({
          where: { id: existing.id, userId },
          data: {
            amountDue: occupancy.monthlyRent,
            dueDate,
            status: nextStatus,
          },
        });
        updated++;
      }
    }
  }

  return { created, updated };
}

export async function ensureRentPaymentsForProperty(args: {
  userId: string;
  propertyId: string;
  now?: Date;
}) {
  return ensureRentPaymentsForUser(args);
}
