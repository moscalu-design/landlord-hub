// Application-wide TypeScript types and enums
// These mirror the Prisma schema string enums and provide type safety at the app layer.

// ─── Enums ────────────────────────────────────────────────────────────────────

export type PropertyType = "HOUSE" | "APARTMENT" | "HMO" | "STUDIO" | "OTHER";
export type PropertyStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type RoomStatus = "VACANT" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
export type TenantStatus = "ACTIVE" | "PAST" | "PENDING" | "BLOCKED";
export type OccupancyStatus = "ACTIVE" | "ENDED" | "PENDING";
export type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL" | "OVERDUE" | "WAIVED";
export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "STANDING_ORDER" | "OTHER";
export type DepositStatus =
  | "PENDING"
  | "PARTIAL"
  | "RECEIVED"
  | "REFUNDED"
  | "PARTIAL_REFUND"
  | "DEDUCTED";
export type DepositTransactionType = "RECEIVED" | "DEDUCTION" | "REFUND" | "ADJUSTMENT";
export type UserRole = "ADMIN" | "VIEWER";

// ─── Label maps for display ────────────────────────────────────────────────────

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: "House",
  APARTMENT: "Apartment",
  HMO: "HMO",
  STUDIO: "Studio",
  OTHER: "Other",
};

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  MAINTENANCE: "Maintenance",
  RESERVED: "Reserved",
};

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: "Active",
  PAST: "Past Tenant",
  PENDING: "Pending",
  BLOCKED: "Blocked",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  OVERDUE: "Overdue",
  WAIVED: "Waived",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank Transfer",
  CASH: "Cash",
  STANDING_ORDER: "Standing Order",
  OTHER: "Other",
};

// ─── UI Badge color variants ───────────────────────────────────────────────────

export const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  VACANT: "bg-amber-100 text-amber-800",
  OCCUPIED: "bg-green-100 text-green-800",
  MAINTENANCE: "bg-red-100 text-red-800",
  RESERVED: "bg-blue-100 text-blue-800",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  PAID: "bg-green-100 text-green-800",
  UNPAID: "bg-slate-100 text-slate-700",
  PARTIAL: "bg-amber-100 text-amber-800",
  OVERDUE: "bg-red-100 text-red-800",
  WAIVED: "bg-purple-100 text-purple-800",
};

export const TENANT_STATUS_COLORS: Record<TenantStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAST: "bg-slate-100 text-slate-700",
  PENDING: "bg-blue-100 text-blue-800",
  BLOCKED: "bg-red-100 text-red-800",
};

export const DEPOSIT_STATUS_COLORS: Record<DepositStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  PARTIAL: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-green-100 text-green-800",
  REFUNDED: "bg-purple-100 text-purple-800",
  PARTIAL_REFUND: "bg-amber-100 text-amber-800",
  DEDUCTED: "bg-red-100 text-red-800",
};

