import { cn } from "@/lib/utils";
import {
  ROOM_STATUS_LABELS,
  ROOM_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  TENANT_STATUS_LABELS,
  TENANT_STATUS_COLORS,
  type RoomStatus,
  type PaymentStatus,
  type TenantStatus,
} from "@/types";

interface BadgeProps {
  className?: string;
  size?: "sm" | "md";
}

export function RoomStatusBadge({ status, className, size = "md" }: BadgeProps & { status: string }) {
  const color = ROOM_STATUS_COLORS[status as RoomStatus] ?? "bg-slate-100 text-slate-700";
  const label = ROOM_STATUS_LABELS[status as RoomStatus] ?? status;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      color, className
    )}>
      {label}
    </span>
  );
}

export function PaymentStatusBadge({ status, className, size = "md" }: BadgeProps & { status: string }) {
  const color = PAYMENT_STATUS_COLORS[status as PaymentStatus] ?? "bg-slate-100 text-slate-700";
  const label = PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      color, className
    )}>
      {label}
    </span>
  );
}

export function TenantStatusBadge({ status, className, size = "md" }: BadgeProps & { status: string }) {
  const color = TENANT_STATUS_COLORS[status as TenantStatus] ?? "bg-slate-100 text-slate-700";
  const label = TENANT_STATUS_LABELS[status as TenantStatus] ?? status;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      color, className
    )}>
      {label}
    </span>
  );
}

export function DepositStatusBadge({ status, className, size = "md" }: BadgeProps & { status: string }) {
  const colorMap: Record<string, string> = {
    PENDING: "bg-slate-100 text-slate-700",
    PARTIAL: "bg-amber-100 text-amber-800",
    RECEIVED: "bg-green-100 text-green-800",
    REFUNDED: "bg-purple-100 text-purple-800",
    PARTIAL_REFUND: "bg-amber-100 text-amber-800",
    DEDUCTED: "bg-red-100 text-red-800",
  };
  const labelMap: Record<string, string> = {
    PENDING: "Pending",
    PARTIAL: "Partial",
    RECEIVED: "Received",
    REFUNDED: "Refunded",
    PARTIAL_REFUND: "Part. Refund",
    DEDUCTED: "Deducted",
  };
  const color = colorMap[status] ?? "bg-slate-100 text-slate-700";
  const label = labelMap[status] ?? status;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      color, className
    )}>
      {label}
    </span>
  );
}
