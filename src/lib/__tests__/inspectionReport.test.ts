import { describe, expect, it } from "vitest";
import {
  buildInspectionReportPdf,
  buildReportFilename,
  formatReportDate,
  type InspectionReportData,
} from "../inspectionReport";

function baseData(): InspectionReportData {
  return {
    property: {
      name: "Willow House",
      address: "12 Example Rd",
      city: "London",
      postcode: "E1 7AA",
    },
    room: { name: "Blue Room" },
    tenant: { firstName: "Alex", lastName: "Smith" },
    inspection: {
      id: "insp_1",
      type: "CHECK_IN",
      date: new Date("2026-03-15T10:00:00Z"),
      notes: "Clean, all lights work.",
    },
    items: [
      {
        id: "item_1",
        itemName: "Double bed",
        condition: "GOOD",
        quantity: 1,
        notes: null,
      },
      {
        id: "item_2",
        itemName: "Desk",
        condition: "DAMAGED",
        quantity: 1,
        notes: "Scratch on left leg",
      },
    ],
    photos: [],
  };
}

function assertPdfBytes(out: Uint8Array) {
  expect(out).toBeInstanceOf(Uint8Array);
  expect(out.length).toBeGreaterThan(200);
  // PDF magic: %PDF-
  const header = Buffer.from(out.slice(0, 5)).toString("ascii");
  expect(header).toBe("%PDF-");
}

describe("buildReportFilename", () => {
  it("uses property name and ISO date slug", () => {
    const data = baseData();
    expect(buildReportFilename(data)).toBe(
      "inspection-report-willow-house-2026-03-15.pdf"
    );
  });

  it("falls back to address when property name is missing", () => {
    const data = baseData();
    data.property!.name = null;
    data.property!.address = "42 Park Lane";
    expect(buildReportFilename(data)).toBe(
      "inspection-report-42-park-lane-2026-03-15.pdf"
    );
  });

  it("falls back to room name when property is missing", () => {
    const data = baseData();
    data.property = null;
    data.room = { name: "Attic" };
    expect(buildReportFilename(data)).toBe(
      "inspection-report-attic-2026-03-15.pdf"
    );
  });

  it("returns a generic slug when nothing is available", () => {
    const data = baseData();
    data.property = null;
    data.room = null;
    expect(buildReportFilename(data)).toBe(
      "inspection-report-report-2026-03-15.pdf"
    );
  });

  it("handles an invalid date gracefully", () => {
    const data = baseData();
    data.inspection.date = "not-a-date";
    const name = buildReportFilename(data);
    expect(name).toMatch(/^inspection-report-willow-house-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});

describe("formatReportDate", () => {
  it("formats ISO strings in en-GB long form", () => {
    expect(formatReportDate("2026-03-15T00:00:00Z")).toMatch(/March 2026/);
  });
});

describe("buildInspectionReportPdf", () => {
  it("produces a valid PDF with no photos", async () => {
    const out = await buildInspectionReportPdf(baseData());
    assertPdfBytes(out);
  });

  it("handles an inspection with no items", async () => {
    const data = baseData();
    data.items = [];
    const out = await buildInspectionReportPdf(data);
    assertPdfBytes(out);
  });

  it("handles missing tenant, room, and property gracefully", async () => {
    const data = baseData();
    data.tenant = null;
    data.room = null;
    data.property = null;
    const out = await buildInspectionReportPdf(data);
    assertPdfBytes(out);
  });

  it("embeds an unsupported image format as a placeholder without failing", async () => {
    const data = baseData();
    data.photos = [
      {
        id: "p1",
        fileName: "hallway.heic",
        fileType: "image/heic",
        inspectionItemId: null,
        bytes: new Uint8Array([1, 2, 3, 4, 5]),
      },
    ];
    const out = await buildInspectionReportPdf(data);
    assertPdfBytes(out);
  });

  it("produces a PDF when item notes are very long (wraps cleanly)", async () => {
    const data = baseData();
    data.items[1].notes =
      "This is a very long note. ".repeat(80) +
      "It should wrap across multiple lines without breaking the layout.";
    const out = await buildInspectionReportPdf(data);
    assertPdfBytes(out);
  });

  it("handles many items without crashing", async () => {
    const data = baseData();
    data.items = Array.from({ length: 25 }, (_, i) => ({
      id: `item_${i}`,
      itemName: `Inventory Item ${i + 1}`,
      condition: i % 2 === 0 ? "GOOD" : "FAIR",
      quantity: 1,
      notes: i % 3 === 0 ? "Some notes about this item" : null,
    }));
    const out = await buildInspectionReportPdf(data);
    assertPdfBytes(out);
    // A single-item PDF is ~3KB; 25 items with notes should be noticeably larger.
    const smallOut = await buildInspectionReportPdf(baseData());
    expect(out.length).toBeGreaterThan(smallOut.length);
  });

  it("embeds a valid JPEG when bytes are present", async () => {
    // Use a minimally valid JPEG so pdf-lib's embedJpg succeeds.
    // We use the packaged one-pixel JPEG from pdf-lib tests equivalent.
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
      0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
      0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
      0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
      0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
      0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd0, 0xff, 0xd9,
    ]);
    const data = baseData();
    data.photos = [
      {
        id: "p1",
        fileName: "bed.jpg",
        fileType: "image/jpeg",
        inspectionItemId: "item_1",
        bytes: new Uint8Array(jpeg),
      },
    ];
    const out = await buildInspectionReportPdf(data);
    assertPdfBytes(out);
  });
});

