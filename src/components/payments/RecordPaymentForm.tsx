"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { recordPayment } from "@/actions/payments";
import { formatCurrency, formatDateShort, formatMonthYear, computePaymentStatus } from "@/lib/utils";
import type { Payment } from "@/generated/prisma/client";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="record-payment-submit"
      disabled={pending}
      className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
    >
      {pending ? "Recording…" : "Record Payment Now"}
    </button>
  );
}

interface RecordPaymentFormProps {
  currentYear: number;
  currentMonth: number;
  todayInputValue: string;
  payments: Payment[];
}

type Period = { year: number; month: number };

function periodKey({ year, month }: Period) {
  return `${year}-${month}`;
}

function sortPeriodsAsc(a: Period, b: Period) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function RecordPaymentForm({
  currentYear,
  currentMonth,
  todayInputValue,
  payments,
}: RecordPaymentFormProps) {
  // Build a rolling 6-month window around today. Always selectable so operators
  // can see "no record" explicitly for a period that doesn't have one.
  const rollingWindow: Period[] = [];
  for (let i = 5; i >= 0; i--) {
    let year = currentYear;
    let month = currentMonth - i;
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
    rollingWindow.push({ year, month });
  }

  // Union the rolling window with every period that actually has a payment record.
  // This covers early move-in (period slightly outside today) and future-start leases
  // (single pre-generated period far ahead of today).
  const byKey = new Map<string, Period>();
  for (const period of rollingWindow) byKey.set(periodKey(period), period);
  for (const payment of payments) {
    const period: Period = { year: payment.periodYear, month: payment.periodMonth };
    byKey.set(periodKey(period), period);
  }
  const options = Array.from(byKey.values()).sort(sortPeriodsAsc);

  // Default to current month if it's selectable, otherwise the earliest period that
  // actually has a payment record (e.g. a future-start lease).
  const sortedPayments = [...payments].sort((a, b) =>
    sortPeriodsAsc(
      { year: a.periodYear, month: a.periodMonth },
      { year: b.periodYear, month: b.periodMonth },
    ),
  );
  const currentPayment = sortedPayments.find(
    (p) => p.periodYear === currentYear && p.periodMonth === currentMonth,
  );
  const nextUnpaidUpcoming = sortedPayments.find((payment) => {
    const status = computePaymentStatus(payment);
    const isFuturePeriod =
      payment.periodYear > currentYear ||
      (payment.periodYear === currentYear && payment.periodMonth > currentMonth);

    return isFuturePeriod && !["PAID", "WAIVED"].includes(status);
  });
  const firstPayment = sortedPayments[0];
  const initial: Period =
    currentPayment && !["PAID", "WAIVED"].includes(computePaymentStatus(currentPayment))
      ? { year: currentPayment.periodYear, month: currentPayment.periodMonth }
      : nextUnpaidUpcoming
      ? { year: nextUnpaidUpcoming.periodYear, month: nextUnpaidUpcoming.periodMonth }
      : firstPayment
      ? { year: firstPayment.periodYear, month: firstPayment.periodMonth }
      : { year: currentYear, month: currentMonth };

  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [selectedMonth, setSelectedMonth] = useState(initial.month);

  const selectedPayment = payments.find(
    (p) => p.periodYear === selectedYear && p.periodMonth === selectedMonth
  );
  const selectedStatus = selectedPayment ? computePaymentStatus(selectedPayment) : null;

  const action = selectedPayment
    ? recordPayment.bind(null, selectedPayment.id)
    : null;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Rent Period</label>
        <select
          value={`${selectedYear}-${selectedMonth}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            setSelectedYear(y);
            setSelectedMonth(m);
          }}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {options.map(({ year, month }) => (
            <option key={`${year}-${month}`} value={`${year}-${month}`}>
              {formatMonthYear(year, month)}
            </option>
          ))}
        </select>
      </div>

      {selectedPayment && (
        <div
          data-testid="selected-payment-summary"
          className="bg-slate-50 rounded-lg px-3 py-2.5 space-y-2 text-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-700 font-medium">
              Applying payment to {formatMonthYear(selectedPayment.periodYear, selectedPayment.periodMonth)}
            </span>
            <PaymentStatusBadge status={selectedStatus ?? selectedPayment.status} size="sm" />
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-600">
            <span>Due: {formatCurrency(selectedPayment.amountDue)}</span>
            <span>Due date: {formatDateShort(selectedPayment.dueDate)}</span>
          </div>
        </div>
      )}

      {action ? (
        <form action={action} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Amount Paid (€)</label>
            <input
              name="amountPaid"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={selectedPayment?.amountPaid || selectedPayment?.amountDue || ""}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Date Paid</label>
            <input
              name="paidAt"
              type="date"
              defaultValue={todayInputValue}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Method</label>
            <select
              name="paymentMethod"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select —</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="STANDING_ORDER">Standing Order</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
            <input
              name="notes"
              type="text"
              placeholder="Optional…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-xs text-blue-700">
              Save this payment to update the room ledger and tenant balance.
            </p>
          </div>
          <SubmitButton />
        </form>
      ) : (
        <p className="text-xs text-slate-500 text-center py-4">
          No payment record found for this period.
        </p>
      )}
    </div>
  );
}
