import packageJson from "../../package.json";
import { buildSchedule } from "@/lib/mortgage";
import prisma from "@/lib/prisma";
import { readStoredDocument } from "@/lib/documentStorage";
import { ZipBuilder } from "@/lib/zip";

type ExportUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

type CsvValue = string | number | boolean | Date | null | undefined;

type DocumentExport = {
  documentId: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedEntityName: string;
  documentCategory: string;
  originalFilename: string;
  exportedFilePath: string;
  mimeType: string;
  uploadedAt: Date | null;
  notes: string;
  storageUrl: string;
};

const APP_NAME = "Rental App";
const CSV_DIR = "csv";
const DOCUMENT_DIR = "documents";

const CSV_SCHEMAS: Record<string, string[]> = {
  "account_summary.csv": [
    "account_id",
    "name",
    "email",
    "phone",
    "role",
    "export_generated_at",
  ],
  "properties.csv": [
    "property_id",
    "name",
    "address",
    "city",
    "postcode",
    "country",
    "property_type",
    "rental_mode",
    "monthly_rent",
    "total_room_count",
    "bedroom_count",
    "bathroom_count",
    "surface_area_sqm",
    "has_terrace",
    "has_balcony",
    "has_garden",
    "has_parking",
    "is_furnished",
    "description",
    "status",
    "notes",
    "created_at",
    "updated_at",
  ],
  "rooms.csv": [
    "room_id",
    "property_id",
    "name",
    "floor",
    "size_m2",
    "furnished",
    "private_bathroom",
    "monthly_rent",
    "deposit_amount",
    "currency",
    "is_default_whole_property_room",
    "status",
    "notes",
    "created_at",
    "updated_at",
  ],
  "tenants.csv": [
    "tenant_id",
    "first_name",
    "last_name",
    "email",
    "phone",
    "nationality",
    "date_of_birth",
    "emergency_contact",
    "id_type",
    "id_reference",
    "status",
    "notes",
    "created_at",
    "updated_at",
  ],
  "leases.csv": [
    "lease_id",
    "room_id",
    "property_id",
    "tenant_id",
    "lease_start",
    "lease_end",
    "move_in_date",
    "move_out_date",
    "monthly_rent",
    "deposit_required",
    "currency",
    "rent_due_day",
    "payment_grace_period_days",
    "status",
    "notes",
    "created_at",
    "updated_at",
  ],
  "rent_payments.csv": [
    "payment_id",
    "lease_id",
    "room_id",
    "property_id",
    "tenant_id",
    "period_year",
    "period_month",
    "amount_due",
    "amount_paid",
    "currency",
    "status",
    "paid_at",
    "due_date",
    "payment_method",
    "reference",
    "notes",
    "created_at",
    "updated_at",
  ],
  "property_costs.csv": [
    "cost_id",
    "property_id",
    "title",
    "category",
    "amount",
    "currency",
    "payment_date",
    "reporting_year",
    "reporting_month",
    "coverage_start",
    "coverage_end",
    "recurrence_type",
    "provider",
    "notes",
    "receipt_file_name",
    "receipt_file_size",
    "receipt_uploaded_at",
    "created_at",
    "updated_at",
  ],
  "mortgages.csv": [
    "mortgage_id",
    "property_id",
    "label",
    "lender",
    "type",
    "start_date",
    "term_months",
    "initial_balance",
    "interest_rate",
    "monthly_payment",
    "currency",
    "is_active",
    "notes",
    "created_at",
    "updated_at",
  ],
  "mortgage_payments_or_schedule.csv": [
    "mortgage_id",
    "property_id",
    "payment_index",
    "payment_date",
    "year",
    "month",
    "balance_before",
    "recurring_payment",
    "interest",
    "scheduled_principal",
    "extra_prepayment",
    "principal",
    "balloon_payment",
    "total_payment",
    "balance_after",
    "currency",
  ],
  "deposits.csv": [
    "deposit_id",
    "lease_id",
    "room_id",
    "property_id",
    "tenant_id",
    "required",
    "received",
    "currency",
    "received_at",
    "status",
    "refunded",
    "refund_amount",
    "refunded_at",
    "deduction_notes",
    "refund_due_date",
    "transaction_id",
    "transaction_type",
    "transaction_amount",
    "transaction_date",
    "transaction_description",
    "created_at",
    "updated_at",
  ],
  "documents_index.csv": [
    "document_id",
    "related_entity_type",
    "related_entity_id",
    "related_entity_name",
    "document_category",
    "original_filename",
    "exported_file_path",
    "mime_type",
    "uploaded_at",
    "notes",
    "export_status",
  ],
  "app_settings.csv": ["setting", "value"],
  "inventory_items.csv": [
    "inventory_item_id",
    "room_id",
    "property_id",
    "name",
    "category",
    "quantity",
    "estimated_value",
    "currency",
    "notes",
    "sort_order",
    "created_at",
    "updated_at",
  ],
  "inventory_inspections.csv": [
    "inspection_id",
    "lease_id",
    "room_id",
    "property_id",
    "tenant_id",
    "type",
    "date",
    "notes",
    "created_at",
    "updated_at",
  ],
  "inventory_inspection_items.csv": [
    "inspection_item_id",
    "inspection_id",
    "inventory_item_id",
    "item_name",
    "condition",
    "quantity",
    "notes",
    "created_at",
    "updated_at",
  ],
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function csvValue(value: CsvValue) {
  if (value instanceof Date) return formatDateTime(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return value == null ? "" : String(value);
}

function escapeCsv(value: CsvValue) {
  const stringValue = csvValue(value);
  if (/[;"\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll("\"", "\"\"")}"`;
  }
  return stringValue;
}

function makeCsv(headers: string[], rows: CsvValue[][]) {
  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map((value) => escapeCsv(value)).join(";"))
    .join("\r\n")}\r\n`;
}

function safeName(value: string | null | undefined, fallback = "item") {
  const cleaned = (value ?? fallback)
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return cleaned || fallback;
}

function extensionFor(fileName: string, mimeType: string) {
  const ext = fileName.match(/\.([A-Za-z0-9]{1,8})$/)?.[1];
  if (ext) return ext.toLowerCase();
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "bin";
}

function readme() {
  return [
    "Rental App account data export",
    "",
    "The csv folder contains Excel-friendly CSV files. Files use UTF-8 with BOM and semicolon delimiters.",
    "IDs are stable application IDs. Foreign key columns such as property_id, room_id, tenant_id, lease_id, mortgage_id, and payment_id link rows across CSV files.",
    "Amounts are exported as raw numeric values. Currency columns are included where the app stores financial values.",
    "Uploaded documents are stored under the documents folder. documents_index.csv maps each exported or missing file back to its source record.",
    "This archive may contain sensitive personal and financial data. Store and share it carefully.",
  ].join("\n");
}

export async function buildAccountExport(user: ExportUser) {
  const generatedAt = new Date();
  const stamp = generatedAt.toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  const root = `rental-app-export_${stamp}`;
  const zip = new ZipBuilder(generatedAt);
  const currency = "GBP";

  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, updatedAt: true },
  });

  const [properties, tenants, occupancies, payments, deposits, inventoryItems, inspections] =
    await Promise.all([
      prisma.property.findMany({
        where: { userId: user.id },
        include: {
          rooms: true,
          expenses: true,
          mortgages: { include: { prepayments: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.tenant.findMany({
        where: { userId: user.id },
        include: { documents: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.occupancy.findMany({
        where: { userId: user.id },
        include: {
          room: { include: { property: true } },
          tenant: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.payment.findMany({
        where: { userId: user.id },
        include: {
          occupancy: {
            include: {
              room: { include: { property: true } },
              tenant: true,
            },
          },
        },
        orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
      }),
      prisma.deposit.findMany({
        where: { userId: user.id },
        include: {
          transactions: { orderBy: { date: "asc" } },
          occupancy: {
            include: {
              room: { include: { property: true } },
              tenant: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.roomInventoryItem.findMany({
        where: { userId: user.id },
        include: { room: { include: { property: true } } },
        orderBy: [{ roomId: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.inventoryInspection.findMany({
        where: { userId: user.id },
        include: {
          occupancy: {
            include: {
              room: { include: { property: true } },
              tenant: true,
            },
          },
          items: true,
          photos: true,
        },
        orderBy: { date: "asc" },
      }),
    ]);

  const rooms = properties.flatMap((property) => property.rooms);
  const expenses = properties.flatMap((property) => property.expenses);
  const mortgages = properties.flatMap((property) => property.mortgages);

  const csvFiles: Record<string, string> = {};
  csvFiles["account_summary.csv"] = makeCsv(CSV_SCHEMAS["account_summary.csv"], [
    [
      user.id,
      userRecord?.name ?? user.name ?? "",
      userRecord?.email ?? user.email ?? "",
      userRecord?.phone ?? "",
      userRecord?.role ?? user.role ?? "",
      formatDateTime(generatedAt),
    ],
  ]);
  csvFiles["properties.csv"] = makeCsv(
    CSV_SCHEMAS["properties.csv"],
    properties.map((property) => [
      property.id,
      property.name,
      property.address,
      property.city,
      property.postcode,
      property.country,
      property.propertyType,
      property.rentalMode,
      property.monthlyRent,
      property.totalRoomCount,
      property.bedroomCount,
      property.bathroomCount,
      property.surfaceAreaSqm,
      property.hasTerrace,
      property.hasBalcony,
      property.hasGarden,
      property.hasParking,
      property.isFurnished,
      property.description,
      property.status,
      property.notes,
      property.createdAt,
      property.updatedAt,
    ])
  );
  csvFiles["rooms.csv"] = makeCsv(
    CSV_SCHEMAS["rooms.csv"],
    rooms.map((room) => [
      room.id,
      room.propertyId,
      room.name,
      room.floor,
      room.sizeM2,
      room.furnished,
      room.privateBathroom,
      room.monthlyRent,
      room.depositAmount,
      currency,
      room.isDefaultWholePropertyRoom,
      room.status,
      room.notes,
      room.createdAt,
      room.updatedAt,
    ])
  );
  csvFiles["tenants.csv"] = makeCsv(
    CSV_SCHEMAS["tenants.csv"],
    tenants.map((tenant) => [
      tenant.id,
      tenant.firstName,
      tenant.lastName,
      tenant.email,
      tenant.phone,
      tenant.nationality,
      formatDate(tenant.dateOfBirth),
      tenant.emergencyContact,
      tenant.idType,
      tenant.idReference,
      tenant.status,
      tenant.notes,
      tenant.createdAt,
      tenant.updatedAt,
    ])
  );
  csvFiles["leases.csv"] = makeCsv(
    CSV_SCHEMAS["leases.csv"],
    occupancies.map((lease) => [
      lease.id,
      lease.roomId,
      lease.room.propertyId,
      lease.tenantId,
      formatDate(lease.leaseStart),
      formatDate(lease.leaseEnd),
      formatDate(lease.moveInDate),
      formatDate(lease.moveOutDate),
      lease.monthlyRent,
      lease.depositRequired,
      currency,
      lease.rentDueDay,
      lease.paymentGracePeriodDays,
      lease.status,
      lease.notes,
      lease.createdAt,
      lease.updatedAt,
    ])
  );
  csvFiles["rent_payments.csv"] = makeCsv(
    CSV_SCHEMAS["rent_payments.csv"],
    payments.map((payment) => [
      payment.id,
      payment.occupancyId,
      payment.occupancy.roomId,
      payment.occupancy.room.propertyId,
      payment.occupancy.tenantId,
      payment.periodYear,
      payment.periodMonth,
      payment.amountDue,
      payment.amountPaid,
      currency,
      payment.status,
      formatDate(payment.paidAt),
      formatDate(payment.dueDate),
      payment.paymentMethod,
      payment.reference,
      payment.notes,
      payment.createdAt,
      payment.updatedAt,
    ])
  );
  csvFiles["property_costs.csv"] = makeCsv(
    CSV_SCHEMAS["property_costs.csv"],
    expenses.map((expense) => [
      expense.id,
      expense.propertyId,
      expense.title,
      expense.category,
      expense.amount,
      currency,
      formatDate(expense.paymentDate),
      expense.reportingYear,
      expense.reportingMonth,
      formatDate(expense.coverageStart),
      formatDate(expense.coverageEnd),
      expense.recurrenceType,
      expense.provider,
      expense.notes,
      expense.receiptFileName,
      expense.receiptFileSize,
      formatDateTime(expense.receiptUploadedAt),
      expense.createdAt,
      expense.updatedAt,
    ])
  );
  csvFiles["mortgages.csv"] = makeCsv(
    CSV_SCHEMAS["mortgages.csv"],
    mortgages.map((mortgage) => [
      mortgage.id,
      mortgage.propertyId,
      mortgage.label,
      mortgage.lender,
      mortgage.type,
      formatDate(mortgage.startDate),
      mortgage.termMonths,
      mortgage.initialBalance,
      mortgage.interestRate,
      mortgage.monthlyPayment,
      currency,
      mortgage.isActive,
      mortgage.notes,
      mortgage.createdAt,
      mortgage.updatedAt,
    ])
  );
  csvFiles["mortgage_payments_or_schedule.csv"] = makeCsv(
    CSV_SCHEMAS["mortgage_payments_or_schedule.csv"],
    mortgages.flatMap((mortgage) =>
      buildSchedule(mortgage, { prepayments: mortgage.prepayments }).map((entry) => [
        mortgage.id,
        mortgage.propertyId,
        entry.index + 1,
        formatDate(entry.date),
        entry.year,
        entry.month,
        entry.balanceBefore,
        entry.recurringPayment,
        entry.interest,
        entry.scheduledPrincipal,
        entry.extraPrepayment,
        entry.principal,
        entry.balloonPayment,
        entry.totalPayment,
        entry.balanceAfter,
        currency,
      ])
    )
  );
  csvFiles["deposits.csv"] = makeCsv(
    CSV_SCHEMAS["deposits.csv"],
    deposits.flatMap((deposit) => {
      const base = [
        deposit.id,
        deposit.occupancyId,
        deposit.occupancy.roomId,
        deposit.occupancy.room.propertyId,
        deposit.occupancy.tenantId,
        deposit.required,
        deposit.received,
        currency,
        formatDate(deposit.receivedAt),
        deposit.status,
        deposit.refunded,
        deposit.refundAmount,
        formatDate(deposit.refundedAt),
        deposit.deductionNotes,
        formatDate(deposit.refundDueDate),
      ];
      if (deposit.transactions.length === 0) {
        return [[...base, "", "", "", "", "", deposit.createdAt, deposit.updatedAt]];
      }
      return deposit.transactions.map((transaction) => [
        ...base,
        transaction.id,
        transaction.type,
        transaction.amount,
        formatDate(transaction.date),
        transaction.description,
        deposit.createdAt,
        deposit.updatedAt,
      ]);
    })
  );
  csvFiles["app_settings.csv"] = makeCsv(CSV_SCHEMAS["app_settings.csv"], [
    ["app_name", APP_NAME],
    ["app_version", packageJson.version],
    ["storage_urls_exported", "false"],
    ["currency_default", currency],
  ]);
  csvFiles["inventory_items.csv"] = makeCsv(
    CSV_SCHEMAS["inventory_items.csv"],
    inventoryItems.map((item) => [
      item.id,
      item.roomId,
      item.room.propertyId,
      item.name,
      item.category,
      item.quantity,
      item.estimatedValue,
      currency,
      item.notes,
      item.sortOrder,
      item.createdAt,
      item.updatedAt,
    ])
  );
  csvFiles["inventory_inspections.csv"] = makeCsv(
    CSV_SCHEMAS["inventory_inspections.csv"],
    inspections.map((inspection) => [
      inspection.id,
      inspection.occupancyId,
      inspection.occupancy.roomId,
      inspection.occupancy.room.propertyId,
      inspection.occupancy.tenantId,
      inspection.type,
      formatDate(inspection.date),
      inspection.notes,
      inspection.createdAt,
      inspection.updatedAt,
    ])
  );
  csvFiles["inventory_inspection_items.csv"] = makeCsv(
    CSV_SCHEMAS["inventory_inspection_items.csv"],
    inspections.flatMap((inspection) =>
      inspection.items.map((item) => [
        item.id,
        item.inspectionId,
        item.inventoryItemId,
        item.itemName,
        item.condition,
        item.quantity,
        item.notes,
        item.createdAt,
        item.updatedAt,
      ])
    )
  );

  const documentExports: DocumentExport[] = [];
  for (const tenant of tenants) {
    const tenantName = `${tenant.firstName} ${tenant.lastName}`.trim();
    for (const doc of tenant.documents) {
      const ext = extensionFor(doc.fileName, doc.fileType);
      documentExports.push({
        documentId: doc.id,
        relatedEntityType: "tenant",
        relatedEntityId: tenant.id,
        relatedEntityName: tenantName,
        documentCategory: doc.type,
        originalFilename: doc.fileName,
        exportedFilePath: `${root}/${DOCUMENT_DIR}/tenants/tenant_${tenant.id}_${safeName(tenantName)}/${safeName(doc.type)}/${safeName(doc.fileName, `document.${ext}`)}`,
        mimeType: doc.fileType,
        uploadedAt: doc.uploadedAt,
        notes: "",
        storageUrl: doc.storageUrl,
      });
    }
  }
  for (const lease of occupancies) {
    if (!lease.contractStorageUrl || !lease.contractFileName) continue;
    const tenantName = `${lease.tenant.firstName} ${lease.tenant.lastName}`.trim();
    const ext = extensionFor(lease.contractFileName, "application/pdf");
    documentExports.push({
      documentId: `occupancy-contract-${lease.id}`,
      relatedEntityType: "lease",
      relatedEntityId: lease.id,
      relatedEntityName: `${tenantName} - ${lease.room.name}`,
      documentCategory: "contract",
      originalFilename: lease.contractFileName,
      exportedFilePath: `${root}/${DOCUMENT_DIR}/tenants/tenant_${lease.tenantId}_${safeName(tenantName)}/contracts/lease_${lease.id}_${safeName(lease.contractFileName, `contract.${ext}`)}`,
      mimeType: "application/pdf",
      uploadedAt: lease.contractUploadedAt,
      notes: "",
      storageUrl: lease.contractStorageUrl,
    });
  }
  for (const expense of expenses) {
    if (!expense.receiptStorageUrl || !expense.receiptFileName) continue;
    const property = properties.find((item) => item.id === expense.propertyId);
    const ext = extensionFor(expense.receiptFileName, "application/octet-stream");
    documentExports.push({
      documentId: `property-cost-receipt-${expense.id}`,
      relatedEntityType: "property_cost",
      relatedEntityId: expense.id,
      relatedEntityName: expense.title,
      documentCategory: "receipt",
      originalFilename: expense.receiptFileName,
      exportedFilePath: `${root}/${DOCUMENT_DIR}/properties/property_${expense.propertyId}_${safeName(property?.name)}/receipts/cost_${expense.id}_${safeName(expense.receiptFileName, `receipt.${ext}`)}`,
      mimeType: "application/octet-stream",
      uploadedAt: expense.receiptUploadedAt,
      notes: "",
      storageUrl: expense.receiptStorageUrl,
    });
  }
  for (const inspection of inspections) {
    for (const photo of inspection.photos) {
      const ext = extensionFor(photo.fileName, photo.fileType);
      documentExports.push({
        documentId: photo.id,
        relatedEntityType: "inventory_inspection",
        relatedEntityId: inspection.id,
        relatedEntityName: `${inspection.type} ${formatDate(inspection.date)}`,
        documentCategory: photo.inspectionItemId ? "inspection_item_photo" : "inspection_photo",
        originalFilename: photo.fileName,
        exportedFilePath: `${root}/${DOCUMENT_DIR}/rooms/room_${inspection.occupancy.roomId}_${safeName(inspection.occupancy.room.name)}/inspections/inspection_${inspection.id}/${safeName(photo.fileName, `photo.${ext}`)}`,
        mimeType: photo.fileType,
        uploadedAt: photo.uploadedAt,
        notes: "",
        storageUrl: photo.storageUrl,
      });
    }
  }

  const documentStatuses = new Map<string, "exported" | "missing">();
  const missingDocuments: Array<{ document_id: string; reason: string }> = [];
  for (const doc of documentExports) {
    try {
      zip.addFile(doc.exportedFilePath, await readStoredDocument(doc.storageUrl));
      documentStatuses.set(doc.documentId, "exported");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read stored file.";
      console.warn("[account-export] Missing document during export", {
        documentId: doc.documentId,
        relatedEntityType: doc.relatedEntityType,
        relatedEntityId: doc.relatedEntityId,
        message,
      });
      doc.notes = `Document file missing during export: ${message}`;
      doc.exportedFilePath = "";
      documentStatuses.set(doc.documentId, "missing");
      missingDocuments.push({ document_id: doc.documentId, reason: message });
    }
  }

  csvFiles["documents_index.csv"] = makeCsv(
    CSV_SCHEMAS["documents_index.csv"],
    documentExports.map((doc) => [
      doc.documentId,
      doc.relatedEntityType,
      doc.relatedEntityId,
      doc.relatedEntityName,
      doc.documentCategory,
      doc.originalFilename,
      doc.exportedFilePath,
      doc.mimeType,
      formatDateTime(doc.uploadedAt),
      doc.notes,
      documentStatuses.get(doc.documentId) ?? "missing",
    ])
  );

  for (const [fileName, csv] of Object.entries(csvFiles)) {
    zip.addFile(`${root}/${CSV_DIR}/${fileName}`, csv);
  }

  const counts = {
    properties: properties.length,
    rooms: rooms.length,
    tenants: tenants.length,
    leases: occupancies.length,
    rent_payments: payments.length,
    property_costs: expenses.length,
    mortgages: mortgages.length,
    deposits: deposits.length,
    inventory_items: inventoryItems.length,
    inventory_inspections: inspections.length,
    documents: documentExports.length,
    exported_documents: [...documentStatuses.values()].filter((status) => status === "exported").length,
    missing_documents: missingDocuments.length,
  };

  zip.addFile(`${root}/README.txt`, readme());
  zip.addFile(
    `${root}/schema_reference.json`,
    JSON.stringify({ csv_delimiter: ";", csv_encoding: "UTF-8 with BOM", csv: CSV_SCHEMAS }, null, 2)
  );
  zip.addFile(
    `${root}/export_manifest.json`,
    JSON.stringify(
      {
        export_generated_at: formatDateTime(generatedAt),
        app_name: APP_NAME,
        account_id: user.id,
        user_id: user.id,
        counts,
        missing_documents: missingDocuments,
        app_version: packageJson.version,
      },
      null,
      2
    )
  );

  const filename = `${root}.zip`;
  return { filename, buffer: zip.toBuffer(), counts };
}
