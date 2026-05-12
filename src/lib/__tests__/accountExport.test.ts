import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    property: { findMany: vi.fn() },
    tenant: { findMany: vi.fn() },
    occupancy: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    deposit: { findMany: vi.fn() },
    roomInventoryItem: { findMany: vi.fn() },
    inventoryInspection: { findMany: vi.fn() },
  },
  readStoredDocument: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mocks.prisma }));
vi.mock("@/lib/documentStorage", () => ({ readStoredDocument: mocks.readStoredDocument }));

import { buildAccountExport } from "@/lib/accountExport";

function readZipEntries(buffer: Buffer) {
  const entries: Record<string, Buffer> = {};
  let offset = 0;

  while (offset < buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const dataStart = nameStart + nameLength + extraLength;

    expect(compression).toBe(0);
    entries[name] = buffer.subarray(dataStart, dataStart + compressedSize);
    offset = dataStart + compressedSize;
  }

  return entries;
}

function textEntry(entries: Record<string, Buffer>, suffix: string) {
  const key = Object.keys(entries).find((entry) => entry.endsWith(suffix));
  expect(key, `missing ZIP entry ending with ${suffix}`).toBeTruthy();
  return entries[key!].toString("utf8").replace(/^\uFEFF/, "");
}

const now = new Date("2026-05-11T10:20:00.000Z");

function baseData() {
  const property = {
    id: "prop-1",
    name: "Export House",
    address: "1 Main Street",
    city: "London",
    postcode: "E1 1AA",
    country: "UK",
    propertyType: "HOUSE",
    status: "ACTIVE",
    notes: "property notes",
    createdAt: now,
    updatedAt: now,
    rooms: [
      {
        id: "room-1",
        propertyId: "prop-1",
        name: "Blue Room",
        floor: "1",
        sizeM2: 12,
        furnished: true,
        privateBathroom: false,
        monthlyRent: 850,
        depositAmount: 850,
        status: "OCCUPIED",
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    expenses: [
      {
        id: "expense-1",
        propertyId: "prop-1",
        title: "Gas bill",
        category: "GAS",
        amount: 100,
        paymentDate: now,
        reportingYear: 2026,
        reportingMonth: 5,
        coverageStart: null,
        coverageEnd: null,
        recurrenceType: "ONE_OFF",
        provider: "Provider",
        notes: null,
        receiptStorageUrl: "local://receipt.pdf",
        receiptFileName: "receipt.pdf",
        receiptFileSize: 7,
        receiptUploadedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    mortgages: [
      {
        id: "mortgage-1",
        propertyId: "prop-1",
        label: "Main mortgage",
        lender: "Bank",
        notes: null,
        type: "amortizing",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        termMonths: 2,
        initialBalance: 1000,
        interestRate: 0,
        monthlyPayment: 500,
        isActive: true,
        prepayments: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  const tenant = {
    id: "tenant-1",
    firstName: "Alex",
    lastName: "Tenant",
    email: "alex@example.com",
    phone: "123",
    nationality: null,
    dateOfBirth: null,
    emergencyContact: null,
    idType: null,
    idReference: null,
    status: "ACTIVE",
    notes: null,
    createdAt: now,
    updatedAt: now,
    documents: [
      {
        id: "doc-1",
        tenantId: "tenant-1",
        type: "idDocument",
        fileName: "passport.pdf",
        fileType: "application/pdf",
        fileSize: 8,
        storageUrl: "local://passport.pdf",
        uploadedAt: now,
        updatedAt: now,
      },
    ],
  };

  const occupancy = {
    id: "lease-1",
    roomId: "room-1",
    tenantId: "tenant-1",
    leaseStart: new Date("2026-05-01T00:00:00.000Z"),
    leaseEnd: null,
    moveInDate: null,
    moveOutDate: null,
    monthlyRent: 850,
    depositRequired: 850,
    rentDueDay: 1,
    paymentGracePeriodDays: 5,
    status: "ACTIVE",
    notes: null,
    contractStorageUrl: "local://contract.pdf",
    contractFileName: "contract.pdf",
    contractFileSize: 9,
    contractUploadedAt: now,
    createdAt: now,
    updatedAt: now,
    room: { ...property.rooms[0], property },
    tenant,
  };

  const payment = {
    id: "payment-1",
    occupancyId: "lease-1",
    periodYear: 2026,
    periodMonth: 5,
    amountDue: 850,
    amountPaid: 850,
    status: "PAID",
    paidAt: now,
    dueDate: now,
    paymentMethod: "BANK_TRANSFER",
    reference: "ref",
    notes: null,
    createdAt: now,
    updatedAt: now,
    occupancy,
  };

  return {
    user: {
      id: "user-current",
      email: "owner@example.com",
      name: "Owner",
      role: "USER",
      createdAt: now,
      updatedAt: now,
    },
    properties: [property],
    tenants: [tenant],
    occupancies: [occupancy],
    payments: [payment],
    deposits: [],
    inventoryItems: [],
    inspections: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const data = baseData();
  mocks.prisma.user.findUnique.mockResolvedValue(data.user);
  mocks.prisma.property.findMany.mockResolvedValue(data.properties);
  mocks.prisma.tenant.findMany.mockResolvedValue(data.tenants);
  mocks.prisma.occupancy.findMany.mockResolvedValue(data.occupancies);
  mocks.prisma.payment.findMany.mockResolvedValue(data.payments);
  mocks.prisma.deposit.findMany.mockResolvedValue(data.deposits);
  mocks.prisma.roomInventoryItem.findMany.mockResolvedValue(data.inventoryItems);
  mocks.prisma.inventoryInspection.findMany.mockResolvedValue(data.inspections);
  mocks.readStoredDocument.mockImplementation(async (storageUrl: string) =>
    Buffer.from(`file:${storageUrl}`)
  );
});

describe("buildAccountExport", () => {
  it("creates a ZIP with expected CSV files, headers, and scoped account metadata", async () => {
    const result = await buildAccountExport({
      id: "user-current",
      email: "owner@example.com",
      name: "Owner",
      role: "USER",
    });

    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-current" } })
    );
    expect(mocks.prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-current" } })
    );
    expect(mocks.prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-current" } })
    );
    expect(mocks.prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-current" } })
    );

    const entries = readZipEntries(result.buffer);
    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/README.txt"),
        expect.stringContaining("/export_manifest.json"),
        expect.stringContaining("/schema_reference.json"),
        expect.stringContaining("/csv/properties.csv"),
        expect.stringContaining("/csv/tenants.csv"),
        expect.stringContaining("/csv/rent_payments.csv"),
        expect.stringContaining("/csv/documents_index.csv"),
      ])
    );

    const propertiesCsv = textEntry(entries, "/csv/properties.csv");
    expect(propertiesCsv).toContain("property_id;name;address;city");
    expect(propertiesCsv).toContain("prop-1;Export House;1 Main Street;London");

    const paymentsCsv = textEntry(entries, "/csv/rent_payments.csv");
    expect(paymentsCsv).toContain("payment-1;lease-1;room-1;prop-1;tenant-1;2026;5;850;850;GBP");

    const manifest = JSON.parse(textEntry(entries, "/export_manifest.json"));
    expect(manifest.account_id).toBe("user-current");
    expect(manifest.counts).toMatchObject({
      properties: 1,
      rooms: 1,
      tenants: 1,
      rent_payments: 1,
      documents: 3,
      exported_documents: 3,
      missing_documents: 0,
    });
  });

  it("includes uploaded document files without exposing storage URLs", async () => {
    const result = await buildAccountExport({ id: "user-current" });
    const entries = readZipEntries(result.buffer);
    const paths = Object.keys(entries);

    expect(paths).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/documents/tenants/tenant_tenant-1_Alex_Tenant/idDocument/passport.pdf"),
        expect.stringContaining("/documents/tenants/tenant_tenant-1_Alex_Tenant/contracts/lease_lease-1_contract.pdf"),
        expect.stringContaining("/documents/properties/property_prop-1_Export_House/receipts/cost_expense-1_receipt.pdf"),
      ])
    );
    expect(textEntry(entries, "/csv/documents_index.csv")).not.toContain("local://");
  });

  it("records missing documents and still returns the export ZIP", async () => {
    mocks.readStoredDocument.mockImplementation(async (storageUrl: string) => {
      if (storageUrl === "local://passport.pdf") throw new Error("ENOENT");
      return Buffer.from(`file:${storageUrl}`);
    });

    const result = await buildAccountExport({ id: "user-current" });
    const entries = readZipEntries(result.buffer);
    const documentsIndex = textEntry(entries, "/csv/documents_index.csv");
    const manifest = JSON.parse(textEntry(entries, "/export_manifest.json"));

    expect(documentsIndex).toContain("doc-1;tenant;tenant-1;Alex Tenant;idDocument;passport.pdf;;application/pdf");
    expect(documentsIndex).toContain("missing");
    expect(manifest.counts.missing_documents).toBe(1);
    expect(manifest.missing_documents).toEqual([
      { document_id: "doc-1", reason: "ENOENT" },
    ]);
  });
});
