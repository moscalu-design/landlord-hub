/**
 * Seed script: creates realistic sample data for local development
 * Run: npx prisma db seed
 *
 * Creates:
 *  - 1 admin user (admin@landlord.com / password: admin123)
 *  - 1 property (3-bedroom house)
 *  - 3 rooms (Blue Room, Garden Room, Attic Room)
 *  - 3 tenants
 *  - 3 occupancies (all active)
 *  - 12 months of payment history per room
 *  - Deposit records
 *  - Activity log entries
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import type { PrismaClientOptions } from "../src/generated/prisma/internal/prismaNamespace";
import bcrypt from "bcryptjs";

import path from "path";

// process.cwd() = project root (rentalapp/) when running via npx prisma db seed
const dbPath = path.resolve(process.cwd(), "dev.db");
const libsqlUrl = `file:${dbPath}`;
const adapter = new PrismaLibSql({ url: libsqlUrl });
const prisma = new PrismaClient({ adapter } satisfies PrismaClientOptions);

function getDueDate(year: number, month: number, dueDay: number): Date {
  const maxDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(dueDay, maxDay));
}

async function main() {
  console.log("🌱 Seeding database…");

  // ─── Admin user ────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const user = await prisma.user.upsert({
    where: { email: "admin@landlord.com" },
    update: {},
    create: {
      email: "admin@landlord.com",
      password: hashedPassword,
      name: "Admin",
      role: "ADMIN",
    },
  });

  console.log("✓ User created:", user.email);

  // ─── Property ──────────────────────────────────────────────────────────────
  const property = await prisma.property.create({
    data: {
      name: "Oak Street House",
      address: "14 Oak Street",
      city: "London",
      postcode: "E1 6RF",
      country: "UK",
      propertyType: "HMO",
      status: "ACTIVE",
      notes: "3-bedroom HMO. Shared kitchen and living room. Garden access for all tenants.",
    },
  });

  console.log("✓ Property created:", property.name);

  // ─── Activity: property created ────────────────────────────────────────────
  await prisma.activityLog.create({
    data: {
      action: "PROPERTY_CREATED",
      description: `Property "${property.name}" created`,
      entityType: "PROPERTY",
      entityId: property.id,
      userId: user.id,
      propertyId: property.id,
    },
  });

  // ─── Rooms ─────────────────────────────────────────────────────────────────
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        propertyId: property.id,
        name: "Blue Room",
        floor: "Ground",
        sizeM2: 16.5,
        furnished: true,
        privateBathroom: false,
        monthlyRent: 900,
        depositAmount: 900,
        status: "OCCUPIED",
        notes: "Overlooks the front garden. Quiet room.",
      },
    }),
    prisma.room.create({
      data: {
        propertyId: property.id,
        name: "Garden Room",
        floor: "Ground",
        sizeM2: 14.2,
        furnished: true,
        privateBathroom: true,
        monthlyRent: 1050,
        depositAmount: 1050,
        status: "OCCUPIED",
        notes: "Private en-suite bathroom. Direct access to garden.",
      },
    }),
    prisma.room.create({
      data: {
        propertyId: property.id,
        name: "Attic Room",
        floor: "Second",
        sizeM2: 12.0,
        furnished: true,
        privateBathroom: false,
        monthlyRent: 800,
        depositAmount: 800,
        status: "OCCUPIED",
        notes: "Skylights. Best natural light in the house. Shared bathroom on landing.",
      },
    }),
  ]);

  console.log(`✓ ${rooms.length} rooms created`);

  // ─── Tenants ───────────────────────────────────────────────────────────────
  const tenants = await Promise.all([
    prisma.tenant.create({
      data: {
        firstName: "James",
        lastName: "Morrison",
        email: "james.morrison@email.com",
        phone: "+44 7700 123456",
        nationality: "British",
        dateOfBirth: new Date("1992-04-15"),
        emergencyContact: "Sarah Morrison, +44 7700 654321, Sister",
        idType: "PASSPORT",
        idReference: "GB123456789",
        status: "ACTIVE",
        notes: "Reliable tenant. Pays on standing order. Has been here since 2024.",
      },
    }),
    prisma.tenant.create({
      data: {
        firstName: "Priya",
        lastName: "Sharma",
        email: "priya.sharma@email.com",
        phone: "+44 7711 234567",
        nationality: "Indian",
        dateOfBirth: new Date("1995-09-22"),
        emergencyContact: "Raj Sharma, +44 7711 765432, Brother",
        idType: "PASSPORT",
        idReference: "IN987654321",
        status: "ACTIVE",
        notes: "Moved in January 2025. Works in tech. Very tidy.",
      },
    }),
    prisma.tenant.create({
      data: {
        firstName: "Lucas",
        lastName: "Fernandez",
        email: "lucas.fernandez@email.com",
        phone: "+44 7722 345678",
        nationality: "Spanish",
        dateOfBirth: new Date("1998-12-03"),
        emergencyContact: "Maria Fernandez, +34 600 111 222, Mother",
        idType: "NATIONAL_ID",
        idReference: "ES56789012",
        status: "ACTIVE",
        notes: "PhD student at UCL. Has been here since October 2024.",
      },
    }),
  ]);

  console.log(`✓ ${tenants.length} tenants created`);

  // ─── Occupancies ───────────────────────────────────────────────────────────
  const now = new Date();
  const leaseStarts = [
    new Date("2024-03-01"), // James — Blue Room
    new Date("2025-01-01"), // Priya — Garden Room
    new Date("2024-10-01"), // Lucas — Attic Room
  ];

  const occupancies = await Promise.all(
    rooms.map((room, i) =>
      prisma.occupancy.create({
        data: {
          roomId: room.id,
          tenantId: tenants[i].id,
          leaseStart: leaseStarts[i],
          monthlyRent: room.monthlyRent,
          depositRequired: room.depositAmount,
          rentDueDay: 1,
          status: "ACTIVE",
          moveInDate: leaseStarts[i],
        },
      })
    )
  );

  console.log(`✓ ${occupancies.length} occupancies created`);

  // ─── Deposits ──────────────────────────────────────────────────────────────
  await Promise.all(
    occupancies.map((occ, i) =>
      prisma.deposit.create({
        data: {
          occupancyId: occ.id,
          required: rooms[i].depositAmount,
          received: rooms[i].depositAmount,
          receivedAt: leaseStarts[i],
          status: "RECEIVED",
          transactions: {
            create: {
              type: "RECEIVED",
              amount: rooms[i].depositAmount,
              date: leaseStarts[i],
              description: "Initial deposit received",
            },
          },
        },
      })
    )
  );

  console.log("✓ Deposits created");

  // ─── Payments (12 months per occupancy) ───────────────────────────────────
  // Generate payment records from each lease start until current month
  for (let i = 0; i < occupancies.length; i++) {
    const occ = occupancies[i];
    const leaseStart = leaseStarts[i];
    const payments = [];

    let year = leaseStart.getFullYear();
    let month = leaseStart.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    while (
      year < currentYear ||
      (year === currentYear && month <= currentMonth)
    ) {
      const dueDate = getDueDate(year, month, 1);
      const isPast = year < currentYear || (year === currentYear && month < currentMonth);
      const isCurrentMonth = year === currentYear && month === currentMonth;

      // Simulate realistic payment history:
      // - Most months: paid on time via bank transfer
      // - One or two partial/late payments for realism
      // - Current month: one tenant paid, one didn't, one partial
      let status = "UNPAID";
      let amountPaid = 0;
      let paidAt: Date | null = null;
      let paymentMethod: string | null = null;

      if (isPast) {
        // James (index 0): always paid on time
        // Priya (index 1): always paid on time, one partial in March 2025
        // Lucas (index 2): mostly paid, one overdue/late in Nov 2024
        const isMarch2025 = year === 2025 && month === 3;
        const isNov2024 = year === 2024 && month === 11;

        if (i === 1 && isMarch2025) {
          // Partial payment
          status = "PARTIAL";
          amountPaid = 700;
          paidAt = new Date(year, month - 1, 5);
          paymentMethod = "BANK_TRANSFER";
        } else if (i === 2 && isNov2024) {
          // Late payment
          status = "PAID";
          amountPaid = occ.monthlyRent;
          paidAt = new Date(year, month - 1, 18); // paid late
          paymentMethod = "CASH";
        } else {
          status = "PAID";
          amountPaid = occ.monthlyRent;
          paidAt = new Date(year, month - 1, 2); // paid on 2nd
          paymentMethod = "BANK_TRANSFER";
        }
      } else if (isCurrentMonth) {
        // Current month simulation:
        if (i === 0) {
          // James: already paid this month
          status = "PAID";
          amountPaid = occ.monthlyRent;
          paidAt = new Date(year, month - 1, 1);
          paymentMethod = "STANDING_ORDER";
        } else if (i === 1) {
          // Priya: not paid yet (due today or recently)
          status = "UNPAID";
          amountPaid = 0;
        } else {
          // Lucas: partial payment
          status = "PARTIAL";
          amountPaid = 500;
          paidAt = new Date(year, month - 1, 1);
          paymentMethod = "BANK_TRANSFER";
        }
      }

      payments.push({
        occupancyId: occ.id,
        periodYear: year,
        periodMonth: month,
        amountDue: occ.monthlyRent,
        amountPaid,
        status,
        paidAt,
        dueDate,
        paymentMethod,
      });

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    await prisma.payment.createMany({ data: payments });
  }

  console.log("✓ Payment history created");

  // ─── Activity log entries ──────────────────────────────────────────────────
  for (let i = 0; i < occupancies.length; i++) {
    await prisma.activityLog.createMany({
      data: [
        {
          action: "ROOM_ADDED",
          description: `Room "${rooms[i].name}" added to ${property.name}`,
          entityType: "ROOM",
          entityId: rooms[i].id,
          userId: user.id,
          propertyId: property.id,
          roomId: rooms[i].id,
          createdAt: new Date(leaseStarts[i].getTime() - 86400000 * 7), // 1 week before lease
        },
        {
          action: "TENANT_ASSIGNED",
          description: `${tenants[i].firstName} ${tenants[i].lastName} assigned to ${rooms[i].name}`,
          entityType: "OCCUPANCY",
          entityId: occupancies[i].id,
          userId: user.id,
          propertyId: property.id,
          roomId: rooms[i].id,
          tenantId: tenants[i].id,
          occupancyId: occupancies[i].id,
          createdAt: leaseStarts[i],
        },
      ],
    });
  }

  console.log("✓ Activity log seeded");
  console.log("\n✅ Seed complete!");
  console.log("─────────────────────────────────────────");
  console.log("Login credentials:");
  console.log("  Email:    admin@landlord.com");
  console.log("  Password: admin123");
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
