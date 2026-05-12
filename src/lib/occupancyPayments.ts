// Billing rules for occupancies.
//
// The app uses one payment row per calendar month, but the lease start date is the
// billing source of truth:
//   - Each calendar-month bill is due on the tenancy's configured due day
//     (`rentDueDay`).
//   - If the first lease month starts after that due day, the first bill is due
//     on the lease start date so it is not due before the tenancy exists.
//   - Active tenancies keep one upcoming period available so an operator can record
//     an early payment against the next rent period without creating duplicates.

export type PaymentPeriod = { year: number; month: number };
export const DEFAULT_PAYMENT_GRACE_PERIOD_DAYS = 5;

export function toBillingDate(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      12,
      0,
      0,
      0,
    );
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  const parsed = new Date(value);
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    12,
    0,
    0,
    0,
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0, 12, 0, 0, 0).getDate();
}

function clampDayOfMonth(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

export function getPaymentGracePeriodDays(value: number | null | undefined): number {
  if (value == null) return DEFAULT_PAYMENT_GRACE_PERIOD_DAYS;
  return Math.max(0, Math.trunc(value));
}

export function getEffectiveBillingStart(leaseStart: Date | string): Date {
  return toBillingDate(leaseStart);
}

// Produces one period per month, inclusive at both ends. When `to` is before `from`,
// returns just the `from` month (for future-dated leases).
export function listMonthsBetween(from: Date, to: Date): PaymentPeriod[] {
  const start = startOfMonth(from);
  const end = startOfMonth(to);
  const effectiveEnd = end.getTime() < start.getTime() ? start : end;

  const periods: PaymentPeriod[] = [];
  let year = start.getFullYear();
  let month = start.getMonth() + 1;
  const endYear = effectiveEnd.getFullYear();
  const endMonth = effectiveEnd.getMonth() + 1;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push({ year, month });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return periods;
}

export function listPaymentPeriodsForOccupancy(args: {
  leaseStart: Date | string;
  now?: Date;
  includeUpcomingPeriod?: boolean;
}): PaymentPeriod[] {
  const billingStart = getEffectiveBillingStart(args.leaseStart);
  const now = toBillingDate(args.now ?? new Date());
  const periods = listMonthsBetween(billingStart, now);

  if (args.includeUpcomingPeriod !== false && startOfMonth(now).getTime() >= startOfMonth(billingStart).getTime()) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 12, 0, 0, 0);
    periods.push({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 });
  }

  return periods;
}

export function periodKey(period: PaymentPeriod): string {
  return `${period.year}-${period.month}`;
}

export function isSamePeriod(a: PaymentPeriod, b: PaymentPeriod): boolean {
  return a.year === b.year && a.month === b.month;
}

export function getBillDateForPeriod(args: {
  leaseStart: Date | string;
  period: PaymentPeriod;
  rentDueDay: number;
}): Date {
  const day = clampDayOfMonth(args.period.year, args.period.month, args.rentDueDay);
  return new Date(args.period.year, args.period.month - 1, day, 12, 0, 0, 0);
}

export function getPaymentDueDate(args: {
  leaseStart: Date | string;
  period: PaymentPeriod;
  rentDueDay: number;
  paymentGracePeriodDays?: number | null;
}): Date {
  const leaseStart = getEffectiveBillingStart(args.leaseStart);
  const leasePeriod = { year: leaseStart.getFullYear(), month: leaseStart.getMonth() + 1 };
  const legacyGraceDays = getPaymentGracePeriodDays(args.paymentGracePeriodDays);
  const effectiveRentDueDay =
    args.rentDueDay <= 1 && legacyGraceDays > 0
      ? args.rentDueDay + legacyGraceDays - 1
      : args.rentDueDay;
  const configuredDueDate = getBillDateForPeriod({
    leaseStart: args.leaseStart,
    period: args.period,
    rentDueDay: effectiveRentDueDay,
  });

  if (isSamePeriod(args.period, leasePeriod)) {
    return configuredDueDate.getTime() < leaseStart.getTime() ? leaseStart : configuredDueDate;
  }

  return configuredDueDate;
}
