-- CreateTable
CREATE TABLE "PropertyExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "reportingYear" INTEGER NOT NULL,
    "reportingMonth" INTEGER NOT NULL,
    "coverageStart" DATETIME,
    "coverageEnd" DATETIME,
    "recurrenceType" TEXT NOT NULL DEFAULT 'ONE_OFF',
    "provider" TEXT,
    "notes" TEXT,
    "receiptStorageUrl" TEXT,
    "receiptFileName" TEXT,
    "receiptFileSize" INTEGER,
    "receiptUploadedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropertyExpense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
