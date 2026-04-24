"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";

type DepositTransaction = {
  id: string;
  type: string;
  amount: number;
  date: Date | string;
  description: string | null;
};

interface DepositManagerProps {
  occupancyId: string;
  required: number;
  received: number;
  refunded: boolean;
  refundDueDate?: Date | string | null;
  transactions: DepositTransaction[];
  compact?: boolean;
  todayInputValue: string;
}

function formatTotals(required: number, transactions: DepositTransaction[]) {
  const received = transactions
    .filter((tx) => tx.type === "RECEIVED" || tx.type === "ADJUSTMENT")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const deducted = transactions
    .filter((tx) => tx.type === "DEDUCTION")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const refunded = transactions
    .filter((tx) => tx.type === "REFUND")
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    received,
    deducted,
    refunded,
    outstandingDeposit: Math.max(required - received, 0),
    outstandingRefund: Math.max(received - deducted - refunded, 0),
  };
}

export function DepositManager({
  occupancyId,
  required,
  refundDueDate,
  transactions,
  compact = false,
  todayInputValue,
}: DepositManagerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("RECEIVED");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [description, setDescription] = useState("");

  const totals = formatTotals(required, transactions);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("amount", amount);
      formData.set("date", date);
      formData.set("description", description);

      const res = await fetch(`/api/occupancies/${occupancyId}/deposit`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update deposit.");
      }

      setAmount("");
      setDescription("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update deposit.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      data-testid={compact ? "deposit-manager-compact" : "deposit-manager"}
      className={compact ? "space-y-3 mt-3" : "space-y-4 pt-3 border-t border-slate-100"}
    >
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-slate-500">Still due</p>
          <p data-testid="deposit-outstanding-value" className="font-semibold text-slate-800">
            {formatCurrency(totals.outstandingDeposit)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-slate-500">Net refund left</p>
          <p data-testid="deposit-outstanding-refund" className="font-semibold text-slate-800">
            {formatCurrency(totals.outstandingRefund)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-slate-500">Deductions</p>
          <p data-testid="deposit-deductions-total" className="font-semibold text-red-600">
            {formatCurrency(totals.deducted)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-slate-500">Refunded</p>
          <p data-testid="deposit-refunded-total" className="font-semibold text-emerald-700">
            {formatCurrency(totals.refunded)}
          </p>
        </div>
      </div>

      {refundDueDate && (
        <p className="text-xs text-slate-500">
          Refund due by <span className="font-medium text-slate-700">{formatDate(refundDueDate)}</span>
        </p>
      )}

      <button
        type="button"
        data-testid="deposit-update-button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Update Deposit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            data-testid="deposit-update-modal"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Update Deposit</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Record money received, deductions, refunds, or adjustments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                Close
              </button>
            </div>

            <div className="px-5 py-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Action</label>
                    <select
                      data-testid="deposit-action-type"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="RECEIVED">Deposit received</option>
                      <option value="DEDUCTION">Deduction</option>
                      <option value="REFUND">Refund</option>
                      <option value="ADJUSTMENT">Adjustment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Amount (€)</label>
                    <input
                      data-testid="deposit-action-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                    <input
                      data-testid="deposit-action-date"
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                    <input
                      data-testid="deposit-action-description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {error && (
                  <p data-testid="deposit-action-error" className="text-xs text-red-600">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => !pending && setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="deposit-action-submit"
                    disabled={pending}
                    className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {pending ? "Saving…" : "Save deposit update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
