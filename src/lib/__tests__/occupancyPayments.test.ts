import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYMENT_GRACE_PERIOD_DAYS,
  getBillDateForPeriod,
  getPaymentDueDate,
  getPaymentGracePeriodDays,
  getEffectiveBillingStart,
  listMonthsBetween,
  listPaymentPeriodsForOccupancy,
  periodKey,
} from "../occupancyPayments";

describe("getEffectiveBillingStart", () => {
  it("uses lease start as the billing source of truth", () => {
    const leaseStart = new Date("2026-05-01");
    const result = getEffectiveBillingStart(leaseStart);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(12);
  });

  it("accepts ISO date strings without shifting the day", () => {
    const result = getEffectiveBillingStart("2026-05-01");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(1);
  });
});

describe("payment grace period helpers", () => {
  it("defaults the grace period to 5 days when unset", () => {
    expect(getPaymentGracePeriodDays(undefined)).toBe(DEFAULT_PAYMENT_GRACE_PERIOD_DAYS);
    expect(getPaymentGracePeriodDays(null)).toBe(DEFAULT_PAYMENT_GRACE_PERIOD_DAYS);
  });

  it("uses the configured due day as the bill date", () => {
    const billDate = getBillDateForPeriod({
      leaseStart: "2026-04-20",
      period: { year: 2026, month: 4 },
      rentDueDay: 1,
    });
    expect(billDate.getFullYear()).toBe(2026);
    expect(billDate.getMonth()).toBe(3);
    expect(billDate.getDate()).toBe(1);
  });

  it("uses the configured bill day for later periods", () => {
    const billDate = getBillDateForPeriod({
      leaseStart: "2026-04-20",
      period: { year: 2026, month: 5 },
      rentDueDay: 1,
    });
    expect(billDate.getFullYear()).toBe(2026);
    expect(billDate.getMonth()).toBe(4);
    expect(billDate.getDate()).toBe(1);
  });

  it("does not set the first due date before the lease exists", () => {
    const dueDate = getPaymentDueDate({
      leaseStart: "2026-04-20",
      period: { year: 2026, month: 4 },
      rentDueDay: 1,
      paymentGracePeriodDays: 5,
    });
    expect(dueDate.getFullYear()).toBe(2026);
    expect(dueDate.getMonth()).toBe(3);
    expect(dueDate.getDate()).toBe(20);
  });

  it("uses rent due day 5 as the fifth of the invoice month", () => {
    const dueDate = getPaymentDueDate({
      leaseStart: "2026-05-01",
      period: { year: 2026, month: 5 },
      rentDueDay: 5,
      paymentGracePeriodDays: 0,
    });
    expect(dueDate.getFullYear()).toBe(2026);
    expect(dueDate.getMonth()).toBe(4);
    expect(dueDate.getDate()).toBe(5);
  });

  it("treats legacy 1st day plus 5-day setting as due by the fifth", () => {
    const dueDate = getPaymentDueDate({
      leaseStart: "2026-05-01",
      period: { year: 2026, month: 5 },
      rentDueDay: 1,
      paymentGracePeriodDays: 5,
    });
    expect(dueDate.getFullYear()).toBe(2026);
    expect(dueDate.getMonth()).toBe(4);
    expect(dueDate.getDate()).toBe(5);
  });
});

describe("listMonthsBetween", () => {
  it("is inclusive on both ends", () => {
    const periods = listMonthsBetween(new Date("2026-01-15"), new Date("2026-03-05"));
    expect(periods).toEqual([
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
      { year: 2026, month: 3 },
    ]);
  });

  it("returns exactly one period when from and to are in the same month", () => {
    const periods = listMonthsBetween(new Date("2026-04-01"), new Date("2026-04-30"));
    expect(periods).toEqual([{ year: 2026, month: 4 }]);
  });

  it("returns exactly one period when 'to' is before 'from' (future-dated case)", () => {
    const periods = listMonthsBetween(new Date("2026-08-01"), new Date("2026-04-23"));
    expect(periods).toEqual([{ year: 2026, month: 8 }]);
  });

  it("handles December → January crossover", () => {
    const periods = listMonthsBetween(new Date("2025-11-10"), new Date("2026-02-10"));
    expect(periods.map(periodKey)).toEqual([
      "2025-11",
      "2025-12",
      "2026-1",
      "2026-2",
    ]);
  });
});

describe("listPaymentPeriodsForOccupancy", () => {
  const now = new Date("2026-04-23");

  it("standard aligned lease: backfills through current month and keeps one upcoming period", () => {
    const periods = listPaymentPeriodsForOccupancy({
      leaseStart: new Date("2026-01-01"),
      now,
    });
    expect(periods.map(periodKey)).toEqual(["2026-1", "2026-2", "2026-3", "2026-4", "2026-5"]);
  });

  it("future-start lease: creates exactly one record at the lease start month", () => {
    const periods = listPaymentPeriodsForOccupancy({
      leaseStart: new Date("2026-08-01"),
      now,
    });
    expect(periods.map(periodKey)).toEqual(["2026-8"]);
  });

  it("ignores move-in history for billing when the lease starts later", () => {
    const periods = listPaymentPeriodsForOccupancy({
      leaseStart: new Date("2026-08-01"),
      now,
    });
    expect(periods.map(periodKey)).toEqual(["2026-8"]);
  });

  it("lease started mid-month in the past: backfills including that month and the next upcoming period", () => {
    const periods = listPaymentPeriodsForOccupancy({
      leaseStart: new Date("2026-03-18"),
      now,
    });
    expect(periods.map(periodKey)).toEqual(["2026-3", "2026-4", "2026-5"]);
  });

  it("tenancy starts today: first bill is generated today with an upcoming period available", () => {
    const periods = listPaymentPeriodsForOccupancy({
      leaseStart: new Date("2026-04-23"),
      now,
    });
    expect(periods.map(periodKey)).toEqual(["2026-4", "2026-5"]);
  });
});
