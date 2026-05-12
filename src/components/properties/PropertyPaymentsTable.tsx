"use client";

import { useMemo, useState } from "react";
import { recordPayment } from "@/actions/payments";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";
import {
  computePaymentStatus,
  formatCurrency,
  formatDate,
  formatMonthYear,
} from "@/lib/utils";

export type PropertyPaymentRow = {
  id: string;
  tenantName: string;
  roomName: string;
  periodYear: number;
  periodMonth: number;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
};

type StatusFilter = "ALL" | "UNPAID" | "OVERDUE" | "PAID";

function daysOverdue(payment: PropertyPaymentRow) {
  const status = computePaymentStatus(payment);
  if (status !== "OVERDUE") return 0;
  const today = new Date();
  const due = new Date(payment.dueDate);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

function outstanding(payment: PropertyPaymentRow) {
  return Math.max(0, payment.amountDue - payment.amountPaid);
}

export function PropertyPaymentsTable({ payments }: { payments: PropertyPaymentRow[] }) {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return payments
      .map((payment) => ({ ...payment, derivedStatus: computePaymentStatus(payment) }))
      .filter((payment) => filter === "ALL" || payment.derivedStatus === filter);
  }, [payments, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["ALL", "UNPAID", "OVERDUE", "PAID"] as const).map((option) => (
          <button
            key={option}
            type="button"
            data-testid={`property-payments-filter-${option.toLowerCase()}`}
            onClick={() => setFilter(option)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              filter === option
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {option === "ALL" ? "All" : option[0] + option.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No payments match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm" data-testid="property-payments-table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Room</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Billing month</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Due date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Due</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Outstanding</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((payment) => {
                  const isRecording = recordingId === payment.id;
                  const status = payment.derivedStatus;
                  return (
                    <tr key={payment.id} data-testid="property-payment-row" className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-800">{payment.tenantName}</td>
                      <td className="px-4 py-3 text-slate-700">{payment.roomName}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatMonthYear(payment.periodYear, payment.periodMonth)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{formatDate(payment.dueDate)}</div>
                        {daysOverdue(payment) > 0 && (
                          <div className="text-xs text-red-600">
                            {daysOverdue(payment)} days overdue
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(payment.amountDue)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(payment.amountPaid)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {formatCurrency(outstanding(payment))}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        {isRecording ? (
                          <form action={recordPayment.bind(null, payment.id)} className="w-56 space-y-2">
                            <input
                              name="amountPaid"
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              defaultValue={outstanding(payment) || payment.amountDue}
                              data-testid="property-payment-amount"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                            <input
                              name="paidAt"
                              type="date"
                              defaultValue={new Date().toISOString().slice(0, 10)}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                            <select
                              name="paymentMethod"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            >
                              <option value="">Method</option>
                              <option value="BANK_TRANSFER">Bank Transfer</option>
                              <option value="STANDING_ORDER">Standing Order</option>
                              <option value="CASH">Cash</option>
                              <option value="OTHER">Other</option>
                            </select>
                            <input
                              name="reference"
                              placeholder="Reference"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                            <input
                              name="notes"
                              placeholder="Notes"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                data-testid="property-payment-save"
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setRecordingId(null)}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            data-testid="property-payment-record"
                            onClick={() => setRecordingId(payment.id)}
                            disabled={status === "PAID" || status === "WAIVED"}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Record payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
