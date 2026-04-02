"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createExpense, deleteExpense, updateExpense } from "@/actions/expenses";
import { isRecurring, isRecurringActiveInMonth } from "@/lib/expenses";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/validations";

// ─── Types ────────────────────────────────────────────────────────────────────

type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  paymentDate: Date;
  reportingYear: number;
  reportingMonth: number;
  coverageStart: Date | null;
  coverageEnd: Date | null;
  recurrenceType: string;
  provider: string | null;
  notes: string | null;
  receiptFileName: string | null;
  receiptFileSize: number | null;
  receiptUploadedAt: Date | null;
};

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  ELECTRICITY: { label: "Electricity", color: "text-amber-700",  bg: "bg-amber-50",   icon: "⚡" },
  GAS:         { label: "Gas",         color: "text-orange-700", bg: "bg-orange-50",  icon: "🔥" },
  WATER:       { label: "Water",       color: "text-blue-700",   bg: "bg-blue-50",    icon: "💧" },
  HEATING:     { label: "Heating",     color: "text-red-700",    bg: "bg-red-50",     icon: "🌡️" },
  INTERNET:    { label: "Internet",    color: "text-purple-700", bg: "bg-purple-50",  icon: "📶" },
  INSURANCE:   { label: "Insurance",   color: "text-green-700",  bg: "bg-green-50",   icon: "🛡️" },
  MAINTENANCE: { label: "Maintenance", color: "text-slate-700",  bg: "bg-slate-100",  icon: "🔧" },
  REPAIRS:     { label: "Repairs",     color: "text-rose-700",   bg: "bg-rose-50",    icon: "🔨" },
  CLEANING:    { label: "Cleaning",    color: "text-teal-700",   bg: "bg-teal-50",    icon: "🧹" },
  TAXES:       { label: "Taxes",       color: "text-pink-700",   bg: "bg-pink-50",    icon: "📋" },
  OTHER:       { label: "Other",       color: "text-slate-600",  bg: "bg-slate-100",  icon: "📎" },
};

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function formatMonthYear(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

// ─── Expense form ─────────────────────────────────────────────────────────────

function ExpenseForm({
  propertyId,
  editing,
  defaultType = "one-off",
  onDone,
  onCancel,
}: {
  propertyId: string;
  editing: Expense | null;
  defaultType?: "one-off" | "recurring";
  onDone: (newId?: string, message?: string) => void;
  onCancel: () => void;
}) {
  const router = useRouter();

  // Determine initial type from editing expense, fall back to defaultType
  const initType: "one-off" | "recurring" =
    editing && isRecurring(editing) ? "recurring" : defaultType;

  const [costType, setCostType] = useState<"one-off" | "recurring">(initType);
  const [paymentDate, setPaymentDate] = useState(
    editing ? toDateInputValue(editing.paymentDate) : todayStr()
  );
  const [reportingYear, setReportingYear] = useState(
    editing?.reportingYear ?? new Date().getFullYear()
  );
  const [reportingMonth, setReportingMonth] = useState(
    editing?.reportingMonth ?? new Date().getMonth() + 1
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(
    editing
      ? !!(editing.notes || editing.provider || editing.receiptFileName || (costType === "one-off" && editing.coverageStart))
      : false
  );

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear + 1 - i);

  function handlePaymentDateChange(value: string) {
    setPaymentDate(value);
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setReportingYear(d.getFullYear());
        setReportingMonth(d.getMonth() + 1);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.set("recurrenceType", costType === "recurring" ? "MONTHLY" : "ONE_OFF");

    if (costType === "recurring") {
      const startDate = fd.get("startDate") as string;
      fd.set("paymentDate", startDate || todayStr());
      fd.set("coverageStart", startDate || todayStr());
      const endDate = fd.get("endDate") as string;
      if (endDate) fd.set("coverageEnd", endDate);
      // Reporting month/year from start date
      const sd = new Date(startDate || todayStr());
      fd.set("reportingYear", String(sd.getFullYear()));
      fd.set("reportingMonth", String(sd.getMonth() + 1));
    } else {
      fd.set("reportingYear", String(reportingYear));
      fd.set("reportingMonth", String(reportingMonth));
    }

    try {
      let expenseId: string;
      if (editing) {
        await updateExpense(editing.id, propertyId, fd);
        expenseId = editing.id;
      } else {
        const result = await createExpense(propertyId, fd);
        expenseId = result.id;
      }

      if (selectedFile) {
        setUploadProgress("Uploading receipt…");
        const uploadFd = new FormData();
        uploadFd.append("file", selectedFile);
        const res = await fetch(`/api/expenses/${expenseId}/receipt`, { method: "POST", body: uploadFd });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setPending(false);
          setUploadProgress(null);
          router.refresh();
          onDone(expenseId, json.error ?? "Receipt upload failed. Entry saved without receipt.");
          return;
        }
      } else if (editing && removeReceipt && editing.receiptFileName) {
        setUploadProgress("Removing receipt…");
        const res = await fetch(`/api/expenses/${expenseId}/receipt`, { method: "DELETE" });
        if (!res.ok) {
          setPending(false);
          setUploadProgress(null);
          router.refresh();
          onDone(expenseId, "Receipt removal failed.");
          return;
        }
      }

      router.refresh();
      onDone(expenseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
      setUploadProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="expense-form" className="px-5 py-4 border-b border-slate-100 space-y-3">
      <p className="text-xs font-semibold text-slate-700">
        {editing ? "Edit entry" : "New cost entry"}
      </p>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Type toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => { setCostType("one-off"); setShowMore(false); }}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            costType === "one-off" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          One-time
        </button>
        <button
          type="button"
          onClick={() => { setCostType("recurring"); setShowMore(false); }}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
            costType === "recurring" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Monthly recurring
        </button>
      </div>

      {/* Core row: Category + Amount */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            required
            data-testid="expense-category-select"
            defaultValue={editing?.category ?? "ELECTRICITY"}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {costType === "recurring" ? "Amount / month (€)" : "Amount (€)"}
            <span className="text-red-500"> *</span>
          </label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            data-testid="expense-amount-input"
            placeholder="0.00"
            defaultValue={editing?.amount ?? ""}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Date fields: differ by type */}
      {costType === "one-off" ? (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            name="paymentDate"
            type="date"
            required
            data-testid="expense-payment-date-input"
            value={paymentDate}
            onChange={(e) => handlePaymentDateChange(e.target.value)}
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
              defaultValue={editing ? toDateInputValue(editing.coverageStart) : firstOfMonthStr()}
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
              defaultValue={editing ? toDateInputValue(editing.coverageEnd) : ""}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* More details toggle */}
      {!showMore && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          + More details
        </button>
      )}

      {/* Optional fields */}
      {showMore && (
        <div className="space-y-3 pt-1 border-t border-slate-100">
          {/* Description + reporting month (one-off only) */}
          <div className={`grid gap-3 ${costType === "one-off" ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Description
                <span className="ml-1 text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                name="title"
                type="text"
                data-testid="expense-title-input"
                placeholder="e.g. February electricity bill"
                defaultValue={editing?.title ?? ""}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {costType === "one-off" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Shows under month
                  <span className="ml-1 text-slate-400 font-normal">(auto)</span>
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={reportingMonth}
                    data-testid="expense-reporting-month-select"
                    onChange={(e) => setReportingMonth(Number(e.target.value))}
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTH_NAMES.slice(1).map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={reportingYear}
                    data-testid="expense-reporting-year-select"
                    onChange={(e) => setReportingYear(Number(e.target.value))}
                    className="w-24 border border-slate-200 rounded-lg px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Provider + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Provider
                <span className="ml-1 text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                name="provider"
                type="text"
                data-testid="expense-provider-input"
                placeholder="e.g. British Gas"
                defaultValue={editing?.provider ?? ""}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Notes
                <span className="ml-1 text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                name="notes"
                type="text"
                data-testid="expense-notes-input"
                placeholder="Any notes"
                defaultValue={editing?.notes ?? ""}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Receipt (one-off only) */}
          {costType === "one-off" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Receipt
                <span className="ml-1 text-slate-400 font-normal">(optional, PDF / JPG / PNG, max 4 MB)</span>
              </label>
              {editing?.receiptFileName && !selectedFile && (
                <p className="text-xs text-slate-500 mb-1.5">
                  Current: <span className="font-medium text-slate-700">{editing.receiptFileName}</span>
                </p>
              )}
              {editing?.receiptFileName && !selectedFile && removeReceipt && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-1.5">
                  The current receipt will be removed when you save.
                </p>
              )}
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  data-testid="expense-receipt-input"
                  className="hidden"
                  onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setRemoveReceipt(false); }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  data-testid="expense-receipt-choose"
                  className="text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {selectedFile ? "Change file" : "Choose file"}
                </button>
                {editing?.receiptFileName && !selectedFile && (
                  <button
                    type="button"
                    data-testid="expense-receipt-remove"
                    onClick={() => setRemoveReceipt((v) => !v)}
                    className="text-xs text-red-600 hover:text-red-700 transition-colors"
                  >
                    {removeReceipt ? "Keep receipt" : "Remove receipt"}
                  </button>
                )}
                {selectedFile && (
                  <span className="text-xs text-slate-600 truncate max-w-48">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          data-testid={editing ? "expense-save-button" : "expense-add-button"}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {pending ? (uploadProgress ?? "Saving…") : editing ? "Save changes" : "Add entry"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Recurring cost row ───────────────────────────────────────────────────────

function RecurringCostRow({
  expense,
  now,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  now: Date;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const cat = CATEGORY_CONFIG[expense.category] ?? CATEGORY_CONFIG.OTHER;
  const isActive = isRecurringActiveInMonth(expense, now.getFullYear(), now.getMonth() + 1);
  const ended = expense.coverageEnd && new Date(expense.coverageEnd) < now;

  return (
    <div
      data-testid={`expense-row-${expense.id}`}
      className="group flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${cat.bg}`}>
          {cat.icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800">{cat.label}</p>
            {expense.provider && (
              <span className="text-xs text-slate-400">· {expense.provider}</span>
            )}
            {ended && (
              <span className="text-xs font-medium text-slate-400 border border-slate-200 rounded-full px-2 py-0.5">
                Ended
              </span>
            )}
            {!ended && !isActive && (
              <span className="text-xs font-medium text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
                Not started
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Since {formatMonthYear(expense.coverageStart)}
            {expense.coverageEnd && ` · until ${formatMonthYear(expense.coverageEnd)}`}
            {expense.notes && ` · ${expense.notes}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{formatCurrency(expense.amount)}</p>
          <p className="text-xs text-slate-400">/month</p>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            data-testid={`expense-edit-${expense.id}`}
            onClick={() => onEdit(expense)}
            className="text-xs text-slate-400 hover:text-blue-600 transition-colors px-1"
          >
            Edit
          </button>
          <button
            type="button"
            data-testid={`expense-delete-${expense.id}`}
            onClick={() => onDelete(expense.id)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors px-1"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── One-off expense row ──────────────────────────────────────────────────────

function ExpenseRow({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const cat = CATEGORY_CONFIG[expense.category] ?? CATEGORY_CONFIG.OTHER;

  return (
    <div
      data-testid={`expense-row-${expense.id}`}
      className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0 ${cat.bg}`}>
          {cat.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug truncate max-w-64">{expense.title}</p>
          <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
            <span className="text-xs text-slate-400">{formatDate(expense.paymentDate)}</span>
            {expense.provider && (
              <span className="text-xs text-slate-400">· {expense.provider}</span>
            )}
            {expense.notes && (
              <span className="text-xs text-slate-400 italic truncate max-w-40">· {expense.notes}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-sm font-bold text-slate-900">{formatCurrency(expense.amount)}</p>

        {expense.receiptFileName && (
          <a
            href={`/api/expenses/${expense.id}/receipt`}
            data-testid={`expense-receipt-link-${expense.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Receipt: ${expense.receiptFileName}`}
            className="text-blue-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
            </svg>
          </a>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            data-testid={`expense-edit-${expense.id}`}
            onClick={() => onEdit(expense)}
            className="text-xs text-slate-400 hover:text-blue-600 transition-colors px-1"
          >
            Edit
          </button>
          <button
            type="button"
            data-testid={`expense-delete-${expense.id}`}
            onClick={() => onDelete(expense.id)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors px-1"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Month group ──────────────────────────────────────────────────────────────

function MonthGroup({
  year,
  month,
  expenses,
  defaultOpen,
  onEdit,
  onDelete,
}: {
  year: number;
  month: number;
  expenses: Expense[];
  defaultOpen: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={`expense-month-group-${year}-${String(month).padStart(2, "0")}`}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`transition-transform duration-150 text-slate-400 text-xs ${open ? "rotate-90" : "rotate-0"}`}>▶</span>
          <span className="text-sm font-medium text-slate-800">{MONTH_NAMES[month]} {year}</span>
          <span className="text-xs text-slate-400">{expenses.length} {expenses.length === 1 ? "entry" : "entries"}</span>
        </div>
        <span className="text-sm font-semibold text-slate-700">{formatCurrency(total)}</span>
      </button>

      {open && (
        <div className="divide-y divide-slate-50">
          {expenses.map((expense) => (
            <ExpenseRow key={expense.id} expense={expense} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

type FormSlot = { type: "add-recurring" | "add-oneoff" | "edit"; expense?: Expense };

export function PropertyExpensesSection({
  propertyId,
  expenses,
}: {
  propertyId: string;
  expenses: Expense[];
}) {
  const router = useRouter();
  const [formSlot, setFormSlot] = useState<FormSlot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  // Split: recurring vs one-off
  const recurringExpenses = expenses.filter((e) => isRecurring(e));
  const oneOffExpenses = expenses.filter((e) => !isRecurring(e));

  // Sort recurring: active first, ended last
  const sortedRecurring = [...recurringExpenses].sort((a, b) => {
    const aEnded = a.coverageEnd && new Date(a.coverageEnd) < now;
    const bEnded = b.coverageEnd && new Date(b.coverageEnd) < now;
    if (aEnded && !bEnded) return 1;
    if (!aEnded && bEnded) return -1;
    return 0;
  });

  // Monthly totals for recurring (active this month)
  const recurringMonthlyTotal = recurringExpenses
    .filter((e) => isRecurringActiveInMonth(e, thisYear, thisMonth))
    .reduce((sum, e) => sum + e.amount, 0);

  // Summary stats
  const thisMonthOneOff = oneOffExpenses
    .filter((e) => e.reportingYear === thisYear && e.reportingMonth === thisMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  // Group one-off by reporting month
  const monthKeys = Array.from(
    new Set(oneOffExpenses.map((e) => `${e.reportingYear}-${String(e.reportingMonth).padStart(2, "0")}`))
  ).sort((a, b) => b.localeCompare(a));

  const grouped: Record<string, Expense[]> = {};
  for (const e of oneOffExpenses) {
    const key = `${e.reportingYear}-${String(e.reportingMonth).padStart(2, "0")}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  function handleEdit(expense: Expense) {
    setNotice(null);
    setFormSlot({ type: "edit", expense });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this cost entry? This cannot be undone.")) return;
    await deleteExpense(id, propertyId);
    router.refresh();
    setNotice(null);
  }

  function handleFormDone(_newId?: string, message?: string) {
    setFormSlot(null);
    setNotice(message ?? null);
  }

  const isEditing = formSlot?.type === "edit";
  const isAddingRecurring = formSlot?.type === "add-recurring";
  const isAddingOneOff = formSlot?.type === "add-oneoff";

  return (
    <div data-testid="property-expenses-section" className="space-y-4">
      {notice && (
        <div data-testid="expense-notice" className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {notice}
        </div>
      )}

      {/* Edit form (floats above sections when editing) */}
      {isEditing && formSlot?.expense && (
        <div className="bg-white border border-slate-200 rounded-xl">
          <ExpenseForm
            propertyId={propertyId}
            editing={formSlot.expense}
            onDone={handleFormDone}
            onCancel={() => setFormSlot(null)}
          />
        </div>
      )}

      {/* ── Recurring Fixed Costs ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Recurring Fixed Costs</h2>
            {recurringMonthlyTotal > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(recurringMonthlyTotal)}/month active</p>
            )}
          </div>
          {!isAddingRecurring && !isEditing && (
            <button
              onClick={() => setFormSlot({ type: "add-recurring" })}
              data-testid="expense-add-toggle"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add recurring
            </button>
          )}
        </div>

        {isAddingRecurring && (
          <ExpenseForm
            propertyId={propertyId}
            editing={null}
            defaultType="recurring"
            onDone={handleFormDone}
            onCancel={() => setFormSlot(null)}
          />
        )}

        {sortedRecurring.length === 0 && !isAddingRecurring ? (
          <div className="px-5 py-6 text-center">
            <p className="text-xs text-slate-400">No recurring costs yet.</p>
            <p className="text-xs text-slate-400 mt-0.5">Add fixed monthly costs like internet, insurance, or cleaning.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedRecurring.map((expense) => (
              <RecurringCostRow
                key={expense.id}
                expense={expense}
                now={now}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Variable / One-off Costs ────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Variable Costs</h2>
            {oneOffExpenses.length > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {formatCurrency(thisMonthOneOff)} one-off this month
              </p>
            )}
          </div>
          {!isAddingOneOff && !isEditing && (
            <button
              onClick={() => setFormSlot({ type: "add-oneoff" })}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0 ml-4"
            >
              + Add entry
            </button>
          )}
        </div>

        {isAddingOneOff && (
          <ExpenseForm
            propertyId={propertyId}
            editing={null}
            defaultType="one-off"
            onDone={handleFormDone}
            onCancel={() => setFormSlot(null)}
          />
        )}

        {oneOffExpenses.length === 0 && !isAddingOneOff ? (
          <p className="text-xs text-slate-400 text-center py-6">
            No variable cost entries yet. Add bills, repairs, or other one-off costs.
          </p>
        ) : (
          <div>
            {monthKeys.map((key) => {
              const [yearStr, monthStr] = key.split("-");
              const year = Number(yearStr);
              const month = Number(monthStr);
              const isCurrentMonth = year === thisYear && month === thisMonth;
              return (
                <MonthGroup
                  key={key}
                  year={year}
                  month={month}
                  expenses={grouped[key]}
                  defaultOpen={isCurrentMonth}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
