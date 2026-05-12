import { describe, it, expect } from "vitest";
import {
  MortgagePrepaymentSchema,
  MortgageSchema,
  OccupancySchema,
  PaymentSchema,
  PropertySchema,
  RoomSchema,
  TenantSchema,
} from "../validations";

// ─── PropertySchema ───────────────────────────────────────────────────────────

describe("PropertySchema", () => {
  const valid = {
    name: "Test Property",
    address: "123 Main St",
    city: "London",
  };

  it("accepts a valid property", () => {
    expect(() => PropertySchema.parse(valid)).not.toThrow();
  });

  it("rejects missing name", () => {
    expect(() => PropertySchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("rejects missing address", () => {
    expect(() => PropertySchema.parse({ ...valid, address: "" })).toThrow();
  });

  it("rejects missing city", () => {
    expect(() => PropertySchema.parse({ ...valid, city: "" })).toThrow();
  });

  it("defaults propertyType to HOUSE", () => {
    const result = PropertySchema.parse(valid);
    expect(result.propertyType).toBe("HOUSE");
  });

  it("rejects invalid propertyType", () => {
    expect(() => PropertySchema.parse({ ...valid, propertyType: "CASTLE" })).toThrow();
  });

  it("defaults rentalMode to ROOM_LEVEL", () => {
    const result = PropertySchema.parse(valid);
    expect(result.rentalMode).toBe("ROOM_LEVEL");
  });

  it("requires monthlyRent for full-property rentals", () => {
    expect(() =>
      PropertySchema.parse({ ...valid, rentalMode: "FULL_PROPERTY" })
    ).toThrow("Monthly rent is required for whole-property rentals");
  });

  it("accepts static property room counts without creating rentable rooms", () => {
    const result = PropertySchema.parse({
      ...valid,
      totalRoomCount: "5",
      bedroomCount: "3",
      bathroomCount: "2",
    });

    expect(result.totalRoomCount).toBe(5);
    expect(result.bedroomCount).toBe(3);
    expect(result.bathroomCount).toBe(2);
  });
});

// ─── RoomSchema ───────────────────────────────────────────────────────────────

describe("RoomSchema", () => {
  const valid = {
    name: "Blue Room",
    monthlyRent: 900,
    depositAmount: 900,
  };

  it("accepts a valid room", () => {
    expect(() => RoomSchema.parse(valid)).not.toThrow();
  });

  it("rejects missing name", () => {
    expect(() => RoomSchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("rejects negative rent", () => {
    expect(() => RoomSchema.parse({ ...valid, monthlyRent: -1 })).toThrow();
  });

  it("allows zero rent", () => {
    expect(() => RoomSchema.parse({ ...valid, monthlyRent: 0 })).not.toThrow();
  });

  it("defaults furnished to true", () => {
    const result = RoomSchema.parse(valid);
    expect(result.furnished).toBe(true);
  });
});

// ─── TenantSchema ─────────────────────────────────────────────────────────────

describe("TenantSchema", () => {
  const valid = {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
  };

  it("accepts a valid tenant", () => {
    expect(() => TenantSchema.parse(valid)).not.toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => TenantSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });

  it("rejects missing first name", () => {
    expect(() => TenantSchema.parse({ ...valid, firstName: "" })).toThrow();
  });

  it("rejects missing last name", () => {
    expect(() => TenantSchema.parse({ ...valid, lastName: "" })).toThrow();
  });

  it("defaults status to ACTIVE", () => {
    const result = TenantSchema.parse(valid);
    expect(result.status).toBe("ACTIVE");
  });
});

// ─── OccupancySchema ──────────────────────────────────────────────────────────

describe("OccupancySchema", () => {
  const valid = {
    roomId: "room-1",
    tenantId: "tenant-1",
    leaseStart: "2024-01-01",
    monthlyRent: 900,
    depositRequired: 900,
  };

  it("accepts a valid occupancy", () => {
    expect(() => OccupancySchema.parse(valid)).not.toThrow();
  });

  it("accepts leaseEnd after leaseStart", () => {
    expect(() =>
      OccupancySchema.parse({ ...valid, leaseEnd: "2025-01-01" })
    ).not.toThrow();
  });

  it("rejects leaseEnd before leaseStart", () => {
    expect(() =>
      OccupancySchema.parse({ ...valid, leaseEnd: "2023-12-31" })
    ).toThrow("Lease end must be after lease start");
  });

  it("accepts empty leaseEnd (open-ended lease)", () => {
    expect(() =>
      OccupancySchema.parse({ ...valid, leaseEnd: "" })
    ).not.toThrow();
  });

  it("clamps rentDueDay between 1 and 28", () => {
    expect(() =>
      OccupancySchema.parse({ ...valid, rentDueDay: 0 })
    ).toThrow();
    expect(() =>
      OccupancySchema.parse({ ...valid, rentDueDay: 29 })
    ).toThrow();
  });

  it("defaults paymentGracePeriodDays to 5", () => {
    const parsed = OccupancySchema.parse(valid);
    expect(parsed.paymentGracePeriodDays).toBe(5);
  });

  it("rejects negative paymentGracePeriodDays", () => {
    expect(() =>
      OccupancySchema.parse({ ...valid, paymentGracePeriodDays: -1 })
    ).toThrow();
  });
});

// ─── PaymentSchema ────────────────────────────────────────────────────────────

describe("PaymentSchema", () => {
  it("accepts a valid payment amount", () => {
    expect(() => PaymentSchema.parse({ amountPaid: 900 })).not.toThrow();
  });

  it("accepts zero amount (clearing a payment)", () => {
    expect(() => PaymentSchema.parse({ amountPaid: 0 })).not.toThrow();
  });

  it("rejects negative amount", () => {
    expect(() => PaymentSchema.parse({ amountPaid: -1 })).toThrow();
  });

  it("accepts valid payment methods", () => {
    const methods = ["BANK_TRANSFER", "CASH", "STANDING_ORDER", "OTHER"];
    for (const method of methods) {
      expect(() => PaymentSchema.parse({ amountPaid: 100, paymentMethod: method })).not.toThrow();
    }
  });

  it("rejects invalid payment method", () => {
    expect(() =>
      PaymentSchema.parse({ amountPaid: 100, paymentMethod: "CRYPTO" })
    ).toThrow();
  });
});

// ─── MortgageSchema ───────────────────────────────────────────────────────────

describe("MortgageSchema", () => {
  const valid = {
    label: "Main Mortgage",
    type: "amortizing",
    startDate: "2026-01-01",
    termMonths: 240,
    initialBalance: 200000,
    interestRate: 3.125,
  };

  it("accepts a valid amortizing mortgage", () => {
    expect(() => MortgageSchema.parse(valid)).not.toThrow();
  });

  it("accepts a bullet mortgage", () => {
    expect(() => MortgageSchema.parse({ ...valid, type: "bullet" })).not.toThrow();
  });

  it("rejects missing mortgage name", () => {
    expect(() => MortgageSchema.parse({ ...valid, label: "" })).toThrow();
  });

  it("accepts up to five decimal places for interest rate", () => {
    expect(() => MortgageSchema.parse({ ...valid, interestRate: 3.12345 })).not.toThrow();
  });

  it("rejects more than five decimal places for interest rate", () => {
    expect(() => MortgageSchema.parse({ ...valid, interestRate: 3.123456 })).toThrow();
  });
});

describe("MortgagePrepaymentSchema", () => {
  const valid = {
    type: "recurring",
    amount: 250,
    startDate: "2026-06-01",
    endDate: "2026-12-01",
    frequency: "monthly",
  };

  it("accepts a valid recurring prepayment plan", () => {
    expect(() => MortgagePrepaymentSchema.parse(valid)).not.toThrow();
  });

  it("accepts a valid one-off prepayment", () => {
    expect(() =>
      MortgagePrepaymentSchema.parse({
        type: "one_off",
        amount: 1000,
        startDate: "2026-09-01",
      })
    ).not.toThrow();
  });

  it("rejects a recurring prepayment without monthly frequency", () => {
    expect(() =>
      MortgagePrepaymentSchema.parse({ ...valid, frequency: undefined })
    ).toThrow();
  });

  it("rejects end dates before the start date", () => {
    expect(() =>
      MortgagePrepaymentSchema.parse({ ...valid, endDate: "2026-05-01" })
    ).toThrow("End date must be on or after the start date");
  });
});
