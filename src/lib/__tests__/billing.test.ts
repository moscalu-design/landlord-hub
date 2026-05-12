import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    occupancy: { findMany: vi.fn() },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));

import { ensureRentPaymentsForProperty } from "@/lib/billing";

const may12 = new Date("2026-05-12T12:00:00.000Z");
const occupancy = {
  id: "occ-1",
  userId: "user-a",
  roomId: "room-1",
  tenantId: "tenant-1",
  leaseStart: new Date("2026-05-01T12:00:00.000Z"),
  monthlyRent: 1200,
  rentDueDay: 1,
  paymentGracePeriodDays: 5,
  status: "ACTIVE",
  payments: [],
  room: { propertyId: "prop-1" },
};

describe("ensureRentPaymentsForProperty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.payment.create.mockResolvedValue({ id: "payment-new" });
    mocks.prisma.payment.update.mockResolvedValue({ id: "payment-existing" });
  });

  it("creates missing scoped monthly rent charges with May 5 due date and overdue status", async () => {
    mocks.prisma.occupancy.findMany.mockResolvedValue([occupancy]);

    await ensureRentPaymentsForProperty({
      userId: "user-a",
      propertyId: "prop-1",
      now: may12,
    });

    expect(mocks.prisma.occupancy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-a",
          status: "ACTIVE",
          room: { propertyId: "prop-1", userId: "user-a" },
        },
      })
    );
    expect(mocks.prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-a",
          occupancyId: "occ-1",
          periodYear: 2026,
          periodMonth: 5,
          amountDue: 1200,
          status: "OVERDUE",
        }),
      })
    );
    const createdDueDate = mocks.prisma.payment.create.mock.calls[0][0].data.dueDate;
    expect(createdDueDate.getFullYear()).toBe(2026);
    expect(createdDueDate.getMonth()).toBe(4);
    expect(createdDueDate.getDate()).toBe(5);
  });

  it("does not duplicate an existing charge for the same tenancy and month", async () => {
    mocks.prisma.occupancy.findMany.mockResolvedValue([
      {
        ...occupancy,
        payments: [
          {
            id: "payment-1",
            occupancyId: "occ-1",
            periodYear: 2026,
            periodMonth: 5,
            amountDue: 1200,
            amountPaid: 0,
            status: "OVERDUE",
            dueDate: new Date("2026-05-05T12:00:00.000Z"),
          },
        ],
      },
    ]);

    await ensureRentPaymentsForProperty({
      userId: "user-a",
      propertyId: "prop-1",
      now: may12,
    });

    expect(mocks.prisma.payment.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          periodYear: 2026,
          periodMonth: 5,
        }),
      })
    );
  });

  it("updates stale due dates and statuses on existing records", async () => {
    mocks.prisma.occupancy.findMany.mockResolvedValue([
      {
        ...occupancy,
        payments: [
          {
            id: "payment-1",
            occupancyId: "occ-1",
            periodYear: 2026,
            periodMonth: 5,
            amountDue: 1200,
            amountPaid: 0,
            status: "UNPAID",
            dueDate: new Date("2026-05-06T12:00:00.000Z"),
          },
        ],
      },
    ]);

    await ensureRentPaymentsForProperty({
      userId: "user-a",
      propertyId: "prop-1",
      now: may12,
    });

    expect(mocks.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-1", userId: "user-a" },
        data: expect.objectContaining({ status: "OVERDUE" }),
      })
    );
    const updatedDueDate = mocks.prisma.payment.update.mock.calls[0][0].data.dueDate;
    expect(updatedDueDate.getDate()).toBe(5);
  });
});
