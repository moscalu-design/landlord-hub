import { describe, expect, it } from "vitest";
import {
  getDisplayRoomStatus,
  isRoomOccupied,
  summarizeRooms,
} from "../roomOccupancy";

describe("roomOccupancy", () => {
  it("treats active occupancies as the source of truth for room counts", () => {
    const summary = summarizeRooms([
      {
        status: "VACANT",
        monthlyRent: 1200,
        occupancies: [{ status: "ACTIVE", monthlyRent: 1150 }],
      },
      {
        status: "OCCUPIED",
        monthlyRent: 900,
        occupancies: [],
      },
      {
        status: "VACANT",
        monthlyRent: 800,
        occupancies: [],
      },
    ]);

    expect(summary.totalRooms).toBe(3);
    expect(summary.occupiedRooms).toBe(1);
    expect(summary.vacantRooms).toBe(2);
    expect(summary.monthlyIncome).toBe(1150);
  });

  it("normalizes stale occupied status when there is no active tenancy", () => {
    expect(
      getDisplayRoomStatus({
        status: "OCCUPIED",
        monthlyRent: 900,
        occupancies: [],
      })
    ).toBe("VACANT");
  });

  it("marks rooms with an active tenancy as occupied", () => {
    expect(
      isRoomOccupied({
        status: "VACANT",
        monthlyRent: 900,
        occupancies: [{ status: "ACTIVE", monthlyRent: 900 }],
      })
    ).toBe(true);
  });
});
