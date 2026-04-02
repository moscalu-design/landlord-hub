"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createExpense } from "@/actions/expenses";
import { getRecurringMonthlyTotal, getExpenseTotalForMonth } from "@/lib/expenses";
import { formatCurrency } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/validations";

type Expense = {
  amount: number;
  category: string;
  recurrenceType: string;
  reportingYear: number;
  reportingMonth: number;
  coverageStart: Date | null;
  coverageEnd: Date | null;
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  ELECTRICITY: { label: "Electricity", icon: "⚡" },
  GAS:         { label: "Gas",         icon: "🔥" },
  WATER:       { label: "Water",       icon: "💧" },
  HEATING:     { label: "Heating",     icon: "🌡️" },
  INTERNET:    { label: "Internet",    icon: "📶" },
  INSURANCE:   { label: "Insurance",   icon: "🛡️" },
  MAINTENANCE: { label: "Maintenance", icon: "🔧" },
  REPAIRS:     { label: "Repairs",     icon: "🔨" },
  CLEANING:    { label: "Cleaning",    icon: "🧹" },
  TAXES:       { label: "Taxes",       icon: "📋" },
  OTHER:       { label: "Other",       icon: "📎" },
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Quick Add Modal ──────────────────────────────────────────────────────────

function QuickAddModal({
  propertyId,
  onClose,
}: {
  propertyId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [costType, setCostType] = useState<"one-off" | "recurring">("one-off");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    // Set recurrenceType based on cost type
    fd.set("recurrenceType", costType === "recurring" ? "MONTHLY" : "ONE_OFF");

    // For recurring: paymentDate = start date, coverageStart = start date
    if (costType === "recurring") {
      const startDate = fd.get("startDate") as string;
      fd.set("paymentDate", startDate);
      fd.set("coverageStart", startDate);
      const endDate = fd.get("endDate") as string;
      if (endDate) fd.set("coverageEnd", endDate);
    } else {
      const d = new Date(date);
      fd.set("reportingYear", String(d.getFullYear()));
      fd.set("reportingMonth", String(d.getMonth() + 1));
    }

    try {
      await createExpense(propertyId, fd);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Add Cost</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Type toggle */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setCostType("one-off")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                costType === "one-off"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              One-time
            </button>
            <button
              type="button"
              onClick={() => setCostType("recurring")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                costType === "recurring"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Monthly recurring
            </button>
          </div>

          {/* Category + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select
                name="category"
                required
                defaultValue="ELECTRICITY"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_CONFIG[cat]?.icon} {CATEGORY_CONFIG[cat]?.label ?? cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {costType === "recurring" ? "Amount / month (€)" : "Amount (€)"}
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Date fields */}
          {costType === "one-off" ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input
                name="paymentDate"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Starts <span className="text-red-500">*</span>
                </label>
                <input
                  name="startDate"
                  type="date"
                  required
                  defaultValue={todayStr().slice(0, 7) + "-01"}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Ends
                  <span className="ml-1 text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  name="endDate"
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {pending ? "Adding…" : "Add cost"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <Link
              href={`/properties/${propertyId}/costs`}
              className="ml-auto text-xs text-slate-400 hover:text-blue-600 transition-colors"
            >
              More options →
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main summary ─────────────────────────────────────────────────────────────

export function PropertyCostsSummary({
  propertyId,
  expenses,
}: {
  propertyId: string;
  expenses: Expense[];
}) {
  const [showModal, setShowModal] = useState(false);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  const thisMonthTotal = getExpenseTotalForMonth(expenses, thisYear, thisMonth);
  const recurringMonthly = getRecurringMonthlyTotal(expenses, thisYear, thisMonth);
  const thisYearTotal = Array.from({ length: 12 }, (_, i) => i + 1).reduce(
    (sum, m) => sum + getExpenseTotalForMonth(expenses, thisYear, m),
    0
  );

  return (
    <>
      <div data-testid="property-costs-summary" className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-800">Costs</h2>
          <Link
            href={`/properties/${propertyId}/costs`}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-base font-bold text-slate-900">{formatCurrency(thisMonthTotal)}</p>
            <p className="text-xs text-slate-500 mt-0.5">This month</p>
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-base font-bold text-slate-900">{formatCurrency(recurringMonthly)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Recurring/mo</p>
          </div>
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-base font-bold text-slate-900">{formatCurrency(thisYearTotal)}</p>
            <p className="text-xs text-slate-500 mt-0.5">This year</p>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="w-full text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg py-2 transition-colors"
        >
          + Quick Add Cost
        </button>
      </div>

      {showModal && (
        <QuickAddModal propertyId={propertyId} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
