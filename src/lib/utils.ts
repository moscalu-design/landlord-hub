import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isAfter, startOfMonth, endOfMonth } from "date-fns";

// shadcn/ui utility (kept here so shadcn imports still resolve)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Currency formatting ───────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Date formatting ───────────────────────────────────────────────────────────

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy, HH:mm");
}

// ─── Payment status computation ────────────────────────────────────────────────

export function computePaymentStatus(payment: {
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: Date | string;
}): string {
  if (payment.status === "WAIVED") return "WAIVED";
  if (payment.amountPaid >= payment.amountDue) return "PAID";
  if (payment.amountPaid > 0) return "PARTIAL";
  if (isAfter(new Date(), new Date(payment.dueDate))) return "OVERDUE";
  return "UNPAID";
}

// ─── Month/year utilities ─────────────────────────────────────────────────────

export function getMonthRange(year: number, month: number) {
  const date = new Date(year, month - 1, 1);
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function getDueDate(year: number, month: number, dueDay: number): Date {
  const maxDay = new Date(year, month, 0).getDate();
  const day = Math.min(dueDay, maxDay);
  return new Date(year, month - 1, day);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function truncate(str: string, length = 80): string {
  return str.length > length ? str.slice(0, length) + "…" : str;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? singular + "s")}`;
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

export function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
