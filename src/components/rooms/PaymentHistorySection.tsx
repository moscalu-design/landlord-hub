"use client";

import { useMemo, useState } from "react";
import { PaymentStatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils";

const PAGE_SIZE = 5;

export interface RoomPaymentHistoryRow {
  id: string;
  payerName: string;
  periodYear: number;
  periodMonth: number;
  amountDue: number;
  amountPaid: number;
  paidAt: Date | string | null;
  paymentMethod: string | null;
  status: string;
}

export function PaymentHistorySection({
  roomId,
  payments,
}: {
  roomId: string;
  payments: RoomPaymentHistoryRow[];
}) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const visiblePayments = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return payments.slice(start, start + PAGE_SIZE);
  }, [payments, safePage]);

  const startIndex = payments.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, payments.length);

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Payment History</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing the latest {Math.min(PAGE_SIZE, payments.length)} payments first
          </p>
        </div>

        {payments.length > 0 && (
          <a
            href={`/api/rooms/${roomId}/payments/export`}
            data-testid="payment-history-export"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Export to Excel
          </a>
        )}
      </div>

      {payments.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500 text-center">
          No payment history yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Period</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Payer</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Due</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Paid</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Date Paid</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Method</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {formatMonthYear(payment.periodYear, payment.periodMonth)}
                    </td>
                    <td className="px-5 py-3 text-slate-700" data-testid="payment-history-payer">
                      {payment.payerName}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{formatCurrency(payment.amountDue)}</td>
                    <td className="px-5 py-3 text-slate-700">
                      {payment.amountPaid > 0 ? formatCurrency(payment.amountPaid) : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(payment.paidAt)}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {payment.paymentMethod?.replaceAll("_", " ") ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <PaymentStatusBadge status={payment.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Showing {startIndex}-{endIndex} of {payments.length}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="payment-history-prev"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                data-testid="payment-history-next"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
