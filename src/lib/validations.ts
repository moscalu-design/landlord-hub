import { z } from "zod";

// ─── Property ─────────────────────────────────────────────────────────────────

export const PropertySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  address: z.string().min(1, "Address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  postcode: z.string().max(20).optional().or(z.literal("")),
  country: z.string().default("UK"),
  propertyType: z.enum(["HOUSE", "APARTMENT", "HMO", "STUDIO", "OTHER"]).default("HOUSE"),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type PropertyInput = z.infer<typeof PropertySchema>;

// ─── Room ─────────────────────────────────────────────────────────────────────

export const RoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100),
  floor: z.string().max(50).optional().or(z.literal("")),
  sizeM2: z.coerce.number().positive().optional().nullable(),
  furnished: z.boolean().default(true),
  privateBathroom: z.boolean().default(false),
  monthlyRent: z.coerce.number().min(0, "Rent must be 0 or more"),
  depositAmount: z.coerce.number().min(0, "Deposit must be 0 or more"),
  status: z.enum(["VACANT", "OCCUPIED", "MAINTENANCE", "RESERVED"]).default("VACANT"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type RoomInput = z.infer<typeof RoomSchema>;

// ─── Tenant ───────────────────────────────────────────────────────────────────

export const TenantSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(30).optional().or(z.literal("")),
  nationality: z.string().max(100).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")), // ISO date string
  emergencyContact: z.string().max(500).optional().or(z.literal("")),
  idType: z.enum(["PASSPORT", "DRIVERS_LICENSE", "NATIONAL_ID"]).optional().nullable(),
  idReference: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "PAST", "PENDING", "BLOCKED"]).default("ACTIVE"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type TenantInput = z.infer<typeof TenantSchema>;

// ─── Occupancy ────────────────────────────────────────────────────────────────

export const OccupancySchema = z
  .object({
    roomId: z.string().min(1, "Room is required"),
    tenantId: z.string().min(1, "Tenant is required"),
    leaseStart: z.string().min(1, "Lease start date is required"),
    leaseEnd: z.string().optional().or(z.literal("")),
    moveInDate: z.string().optional().or(z.literal("")),
    moveOutDate: z.string().optional().or(z.literal("")),
    monthlyRent: z.coerce.number().min(0, "Rent must be 0 or more"),
    depositRequired: z.coerce.number().min(0, "Deposit must be 0 or more"),
    rentDueDay: z.coerce.number().min(1).max(28).default(1),
    status: z.enum(["ACTIVE", "ENDED", "PENDING"]).default("ACTIVE"),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (d) => !d.leaseEnd || new Date(d.leaseEnd) > new Date(d.leaseStart),
    { message: "Lease end must be after lease start", path: ["leaseEnd"] }
  );

export type OccupancyInput = z.infer<typeof OccupancySchema>;

// ─── Payment ──────────────────────────────────────────────────────────────────

export const PaymentSchema = z.object({
  amountPaid: z.coerce.number().min(0, "Amount must be 0 or more"),
  paidAt: z.string().optional().or(z.literal("")),
  paymentMethod: z
    .enum(["BANK_TRANSFER", "CASH", "STANDING_ORDER", "OTHER"])
    .optional()
    .nullable(),
  reference: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type PaymentInput = z.infer<typeof PaymentSchema>;

// ─── Utility Cost ─────────────────────────────────────────────────────────────

export const UtilityCostSchema = z.object({
  type: z.enum(["ELECTRICITY", "GAS", "INTERNET", "INSURANCE", "CLEANING", "WATER", "TRASH"]),
  provider: z.string().max(100).optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "Amount must be 0 or more"),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_OFF"]).default("MONTHLY"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type UtilityCostInput = z.infer<typeof UtilityCostSchema>;

// ─── Deposit transaction ──────────────────────────────────────────────────────

export const DepositTransactionSchema = z.object({
  type: z.enum(["RECEIVED", "DEDUCTION", "REFUND", "ADJUSTMENT"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  description: z.string().max(500).optional().or(z.literal("")),
});

export type DepositTransactionInput = z.infer<typeof DepositTransactionSchema>;
