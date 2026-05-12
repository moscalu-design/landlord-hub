import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  prisma: {
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { recordPayment } from "@/actions/payments";

describe("recordPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-a", email: "a@example.com" } });
    mocks.prisma.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      userId: "user-a",
      amountDue: 1200,
      amountPaid: 0,
      status: "OVERDUE",
      dueDate: new Date("2026-05-05T12:00:00.000Z"),
    });
    mocks.prisma.payment.update.mockResolvedValue({
      id: "payment-1",
      occupancyId: "occ-1",
      periodYear: 2026,
      periodMonth: 5,
      occupancy: {
        roomId: "room-1",
        tenantId: "tenant-1",
        room: {
          id: "room-1",
          name: "Blue Room",
          propertyId: "prop-1",
        },
      },
    });
  });

  it("updates the scoped payment row and marks a full payment paid", async () => {
    const formData = new FormData();
    formData.set("amountPaid", "1200");
    formData.set("paidAt", "2026-05-12");
    formData.set("paymentMethod", "BANK_TRANSFER");
    formData.set("reference", "TEST-REF");
    formData.set("notes", "Paid in full");

    await recordPayment("payment-1", formData);

    expect(mocks.prisma.payment.findUnique).toHaveBeenCalledWith({
      where: { id: "payment-1", userId: "user-a" },
    });
    expect(mocks.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment-1", userId: "user-a" },
        data: expect.objectContaining({
          amountPaid: 1200,
          status: "PAID",
          paymentMethod: "BANK_TRANSFER",
          reference: "TEST-REF",
          notes: "Paid in full",
        }),
      })
    );
  });

  it("marks a partial payment as partial", async () => {
    const formData = new FormData();
    formData.set("amountPaid", "600");

    await recordPayment("payment-1", formData);

    expect(mocks.prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaid: 600,
          status: "PARTIAL",
        }),
      })
    );
  });
});
