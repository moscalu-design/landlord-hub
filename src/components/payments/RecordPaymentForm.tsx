"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { recordPayment } from "@/actions/payments";
import { formatCurrency, formatMonthYear } from "@/lib/utils";
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
  payments: Payment[];
}

export function RecordPaymentForm({
  currentYear,
  currentMonth,
  payments,
}: RecordPaymentFormProps) {
  // Show the last 6 months as selectable options
  const options = [];
  for (let i = 5; i >= 0; i--) {
    let year = currentYear;
    let month = currentMonth - i;
    if (month <= 0) { month += 12; year -= 1; }
    options.push({ year, month });
  }

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const selectedPayment = payments.find(
    (p) => p.periodYear === selectedYear && p.periodMonth === selectedMonth
  );

  const action = selectedPayment
    ? recordPayment.bind(null, selectedPayment.id)
    : null;

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Period</label>
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
        <div className="bg-slate-50 rounded-lg px-3 py-2.5 flex justify-between text-sm">
          <span className="text-slate-600">
            Due: {formatCurrency(selectedPayment.amountDue)}
          </span>
          <PaymentStatusBadge status={selectedPayment.status} size="sm" />
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
              defaultValue={new Date().toISOString().split("T")[0]}
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
