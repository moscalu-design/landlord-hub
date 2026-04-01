import { describe, it, expect } from "vitest";
import {
  computePaymentStatus,
  getDueDate,
  formatMonthYear,
  formatCurrency,
  truncate,
  pluralize,
  fullName,
  initials,
} from "../utils";

// ─── computePaymentStatus ─────────────────────────────────────────────────────

describe("computePaymentStatus", () => {
  const pastDate = new Date("2020-01-01");
  const futureDate = new Date("2099-01-01");

  it("returns WAIVED when status is WAIVED regardless of amounts", () => {
    expect(
      computePaymentStatus({ amountDue: 1000, amountPaid: 0, status: "WAIVED", dueDate: pastDate })
    ).toBe("WAIVED");
  });

  it("returns PAID when amountPaid >= amountDue", () => {
    expect(
      computePaymentStatus({ amountDue: 1000, amountPaid: 1000, status: "UNPAID", dueDate: futureDate })
    ).toBe("PAID");
    // Overpayment also counts as PAID
    expect(
      computePaymentStatus({ amountDue: 1000, amountPaid: 1200, status: "UNPAID", dueDate: futureDate })
    ).toBe("PAID");
  });

  it("returns PARTIAL when amountPaid > 0 but < amountDue", () => {
    expect(
      computePaymentStatus({ amountDue: 1000, amountPaid: 500, status: "UNPAID", dueDate: futureDate })
    ).toBe("PARTIAL");
  });

  it("returns OVERDUE when unpaid and dueDate is in the past", () => {
    expect(
      computePaymentStatus({ amountDue: 1000, amountPaid: 0, status: "UNPAID", dueDate: pastDate })
    ).toBe("OVERDUE");
  });

  it("returns UNPAID when unpaid and dueDate is in the future", () => {
    expect(
      computePaymentStatus({ amountDue: 1000, amountPaid: 0, status: "UNPAID", dueDate: futureDate })
    ).toBe("UNPAID");
  });

  it("WAIVED takes precedence over OVERDUE", () => {
    expect(
      computePaymentStatus({ amountDue: 1000, amountPaid: 0, status: "WAIVED", dueDate: pastDate })
    ).toBe("WAIVED");
  });
});

// ─── getDueDate ───────────────────────────────────────────────────────────────

describe("getDueDate", () => {
  it("returns the specified day of the month", () => {
    const date = getDueDate(2024, 3, 15);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2); // 0-indexed
    expect(date.getDate()).toBe(15);
  });

  it("clamps to last day of month for short months", () => {
    // February 2024 has 29 days (leap year)
    const feb = getDueDate(2024, 2, 31);
    expect(feb.getDate()).toBe(29);

    // February 2023 has 28 days
    const feb2023 = getDueDate(2023, 2, 31);
    expect(feb2023.getDate()).toBe(28);
  });

  it("clamps day 30 in February", () => {
    const date = getDueDate(2023, 2, 30);
    expect(date.getDate()).toBe(28);
  });

  it("returns correct date for 28-day cap months", () => {
    // April has 30 days, day 28 should work
    const date = getDueDate(2024, 4, 28);
    expect(date.getDate()).toBe(28);
  });
});

// ─── formatMonthYear ─────────────────────────────────────────────────────────

describe("formatMonthYear", () => {
  it("formats month 1 as January", () => {
    expect(formatMonthYear(2024, 1)).toBe("January 2024");
  });

  it("formats month 12 as December", () => {
    expect(formatMonthYear(2024, 12)).toBe("December 2024");
  });

  it("includes the year", () => {
    expect(formatMonthYear(2025, 6)).toBe("June 2025");
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats round euros without decimals", () => {
    expect(formatCurrency(1000)).toBe("€1,000");
  });

  it("formats cents with up to 2 decimal places", () => {
    // minimumFractionDigits is 0, so trailing zeros are omitted
    expect(formatCurrency(1000.5)).toBe("€1,000.5");
    expect(formatCurrency(1000.55)).toBe("€1,000.55");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("€0");
  });

  it("accepts explicit currency override", () => {
    expect(formatCurrency(1000, "GBP")).toBe("£1,000");
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────

describe("truncate", () => {
  it("does not truncate short strings", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    const result = truncate("hello world", 5);
    expect(result).toBe("hello…");
  });

  it("uses default length of 80", () => {
    const long = "a".repeat(81);
    const result = truncate(long);
    expect(result.length).toBe(81); // 80 chars + "…"
    expect(result.endsWith("…")).toBe(true);
  });
});

// ─── pluralize ────────────────────────────────────────────────────────────────

describe("pluralize", () => {
  it("uses singular for count of 1", () => {
    expect(pluralize(1, "room")).toBe("1 room");
  });

  it("uses plural for count != 1", () => {
    expect(pluralize(2, "room")).toBe("2 rooms");
    expect(pluralize(0, "room")).toBe("0 rooms");
  });

  it("uses custom plural when provided", () => {
    expect(pluralize(2, "property", "properties")).toBe("2 properties");
  });
});

// ─── fullName / initials ──────────────────────────────────────────────────────

describe("fullName", () => {
  it("joins first and last name", () => {
    expect(fullName("John", "Smith")).toBe("John Smith");
  });
});

describe("initials", () => {
  it("returns uppercase initials", () => {
    expect(initials("john", "smith")).toBe("JS");
  });

  it("handles single character names", () => {
    expect(initials("A", "B")).toBe("AB");
  });
});
