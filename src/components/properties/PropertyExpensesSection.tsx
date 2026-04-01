"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createExpense, deleteExpense, updateExpense } from "@/actions/expenses";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EXPENSE_CATEGORIES, RECURRENCE_TYPES } from "@/lib/validations";

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

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  ELECTRICITY:  { label: "Electricity",  color: "bg-yellow-100 text-yellow-800",  icon: "⚡" },
  GAS:          { label: "Gas",          color: "bg-orange-100 text-orange-800",  icon: "🔥" },
  WATER:        { label: "Water",        color: "bg-blue-100 text-blue-800",      icon: "💧" },
  HEATING:      { label: "Heating",      color: "bg-red-100 text-red-800",        icon: "🌡️" },
  INTERNET:     { label: "Internet",     color: "bg-purple-100 text-purple-800",  icon: "📶" },
  INSURANCE:    { label: "Insurance",    color: "bg-green-100 text-green-800",    icon: "🛡️" },
  MAINTENANCE:  { label: "Maintenance",  color: "bg-slate-100 text-slate-700",    icon: "🔧" },
  REPAIRS:      { label: "Repairs",      color: "bg-rose-100 text-rose-800",      icon: "🔨" },
  CLEANING:     { label: "Cleaning",     color: "bg-teal-100 text-teal-800",      icon: "🧹" },
  TAXES:        { label: "Taxes",        color: "bg-pink-100 text-pink-800",      icon: "📋" },
  OTHER:        { label: "Other",        color: "bg-slate-100 text-slate-600",    icon: "📎" },
};

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const RECURRENCE_LABELS: Record<string, string> = {
  ONE_OFF:   "One-off",
  MONTHLY:   "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL:    "Annual",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Expense form ─────────────────────────────────────────────────────────────

type FormState = "idle" | "add" | "edit";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function ExpenseForm({
  propertyId,
  editing,
  onDone,
  onCancel,
}: {
  propertyId: string;
  editing: Expense | null;
  onDone: (newId?: string, message?: string) => void;
  onCancel: () => void;
}) {
  const today = todayString();
  const router = useRouter();

  // Payment date drives the default reportingYear/Month
  const defaultPaymentDate = editing
    ? toDateInputValue(editing.paymentDate)
    : today;
  const defaultYear = editing ? editing.reportingYear : new Date().getFullYear();
  const defaultMonth = editing ? editing.reportingMonth : new Date().getMonth() + 1;

  const [paymentDate, setPaymentDate] = useState(defaultPaymentDate);
  const [reportingYear, setReportingYear] = useState(defaultYear);
  const [reportingMonth, setReportingMonth] = useState(defaultMonth);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

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

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear + 1 - i);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    // Ensure reporting year/month from state are included
    formData.set("reportingYear", String(reportingYear));
    formData.set("reportingMonth", String(reportingMonth));

    try {
      let expenseId: string;

      if (editing) {
        await updateExpense(editing.id, propertyId, formData);
        expenseId = editing.id;
      } else {
        const result = await createExpense(propertyId, formData);
        expenseId = result.id;
      }

      // Upload receipt if a file was selected
      if (selectedFile) {
        setUploadProgress("Uploading receipt…");
        const fd = new FormData();
        fd.append("file", selectedFile);
        const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setPending(false);
          setUploadProgress(null);
          router.refresh();
          onDone(expenseId, json.error ?? "Receipt upload failed. The entry was saved without a receipt.");
          return;
        }
      } else if (editing && removeReceipt && editing.receiptFileName) {
        setUploadProgress("Removing receipt…");
        const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setPending(false);
          setUploadProgress(null);
          router.refresh();
          onDone(expenseId, json.error ?? "Receipt removal failed. The entry was saved without removing the receipt.");
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
    <form
      onSubmit={handleSubmit}
      data-testid="expense-form"
      className="px-5 py-4 border-b border-slate-100 space-y-4"
    >
      <p className="text-xs font-semibold text-slate-700">
        {editing ? "Edit entry" : "New cost entry"}
      </p>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Row 1: Title + Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            name="title"
            type="text"
            required
            data-testid="expense-title-input"
            placeholder="e.g. Electricity for February"
            defaultValue={editing?.title ?? ""}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
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
      </div>

      {/* Row 2: Amount + Recurrence */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Amount (€) <span className="text-red-500">*</span>
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
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select
            name="recurrenceType"
            data-testid="expense-recurrence-select"
            defaultValue={editing?.recurrenceType ?? "ONE_OFF"}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {RECURRENCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECURRENCE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Payment date + Reporting month */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Payment Date <span className="text-red-500">*</span>
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
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={reportingYear}
              data-testid="expense-reporting-year-select"
              onChange={(e) => setReportingYear(Number(e.target.value))}
              className="w-24 border border-slate-200 rounded-lg px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Row 4: Coverage period (optional, collapsible) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Coverage from
            <span className="ml-1 text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            name="coverageStart"
            type="date"
            data-testid="expense-coverage-start-input"
            defaultValue={editing ? toDateInputValue(editing.coverageStart) : ""}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Coverage to
            <span className="ml-1 text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            name="coverageEnd"
            type="date"
            data-testid="expense-coverage-end-input"
            defaultValue={editing ? toDateInputValue(editing.coverageEnd) : ""}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Row 5: Provider + Notes */}
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
            placeholder="Any additional notes"
            defaultValue={editing?.notes ?? ""}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Row 6: Receipt PDF */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Payment receipt
          <span className="ml-1 text-slate-400 font-normal">(optional, PDF / JPG / PNG, max 4 MB)</span>
        </label>
        {editing?.receiptFileName && !selectedFile && (
          <p className="text-xs text-slate-500 mb-1.5">
            Current: <span className="font-medium text-slate-700">{editing.receiptFileName}</span>
            {" — selecting a new file will replace it"}
          </p>
        )}
        {editing?.receiptFileName && !selectedFile && removeReceipt && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-1.5">
            The current receipt will be removed when you save this entry.
          </p>
        )}
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            data-testid="expense-receipt-input"
            className="hidden"
            onChange={(e) => {
              setSelectedFile(e.target.files?.[0] ?? null);
              setRemoveReceipt(false);
            }}
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
              onClick={() => setRemoveReceipt((value) => !value)}
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

// ─── Expense row ──────────────────────────────────────────────────────────────

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
      className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cat.color}`}
        >
          {cat.icon} {cat.label}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug">{expense.title}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            <span className="text-xs text-slate-500">{formatDate(expense.paymentDate)}</span>
            {expense.provider && (
              <span className="text-xs text-slate-400">{expense.provider}</span>
            )}
            {(expense.coverageStart || expense.coverageEnd) && (
              <span className="text-xs text-slate-400">
                {expense.coverageStart ? formatDate(expense.coverageStart) : "?"}
                {" – "}
                {expense.coverageEnd ? formatDate(expense.coverageEnd) : "ongoing"}
              </span>
            )}
            {expense.notes && (
              <span className="text-xs text-slate-400 italic truncate max-w-48">
                {expense.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <p className="text-sm font-semibold text-slate-800">
          {formatCurrency(expense.amount)}
        </p>

        {expense.receiptFileName && (
          <a
            href={`/api/expenses/${expense.id}/receipt`}
            data-testid={`expense-receipt-link-${expense.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`View receipt: ${expense.receiptFileName}`}
            className="text-blue-500 hover:text-blue-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        )}

        <button
          type="button"
          data-testid={`expense-edit-${expense.id}`}
          onClick={() => onEdit(expense)}
          className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
          title="Edit"
        >
          Edit
        </button>
        <button
          type="button"
          data-testid={`expense-delete-${expense.id}`}
          onClick={() => onDelete(expense.id)}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          title="Delete"
        >
          ✕
        </button>
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
          <span
            className={`transition-transform duration-150 text-slate-400 text-xs ${open ? "rotate-90" : "rotate-0"}`}
          >
            ▶
          </span>
          <span className="text-sm font-medium text-slate-800">
            {MONTH_NAMES[month]} {year}
          </span>
          <span className="text-xs text-slate-400">
            {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <span className="text-sm font-semibold text-slate-700">
          {formatCurrency(total)}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-slate-50">
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function PropertyExpensesSection({
  propertyId,
  expenses,
}: {
  propertyId: string;
  expenses: Expense[];
}) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>("idle");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Summary stats
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();
  const thisMonthTotal = expenses
    .filter((e) => e.reportingYear === thisYear && e.reportingMonth === thisMonth)
    .reduce((sum, e) => sum + e.amount, 0);
  const thisYearTotal = expenses
    .filter((e) => e.reportingYear === thisYear)
    .reduce((sum, e) => sum + e.amount, 0);

  // Group expenses by reporting year+month, sorted newest first
  const monthKeys = Array.from(
    new Set(
      expenses.map((e) => `${e.reportingYear}-${String(e.reportingMonth).padStart(2, "0")}`)
    )
  ).sort((a, b) => b.localeCompare(a));

  const grouped: Record<string, Expense[]> = {};
  for (const e of expenses) {
    const key = `${e.reportingYear}-${String(e.reportingMonth).padStart(2, "0")}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }

  function handleEdit(expense: Expense) {
    setNotice(null);
    setEditingExpense(expense);
    setFormState("edit");
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this cost entry? This cannot be undone.")) return;
    const expense = expenses.find((e) => e.id === id);
    if (!expense) return;
    await deleteExpense(id, propertyId);
    router.refresh();
    setNotice(null);
  }

  function handleFormDone(_newId?: string, message?: string) {
    setFormState("idle");
    setEditingExpense(null);
    setNotice(message ?? null);
  }

  function handleFormCancel() {
    setFormState("idle");
    setEditingExpense(null);
  }

  return (
    <div data-testid="property-expenses-section" className="bg-white border border-slate-200 rounded-xl">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Utilities &amp; Costs</h2>
          {expenses.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              {formatCurrency(thisMonthTotal)} this month
              <span className="mx-1.5 text-slate-300">·</span>
              {formatCurrency(thisYearTotal)} this year
            </p>
          )}
        </div>
        {formState === "idle" && (
          <button
            onClick={() => setFormState("add")}
            data-testid="expense-add-toggle"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0 ml-4"
          >
            + Add entry
          </button>
        )}
      </div>

      {notice && (
        <div
          data-testid="expense-notice"
          className="mx-5 mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
        >
          {notice}
        </div>
      )}

      {/* Add / Edit form */}
      {formState !== "idle" && (
        <ExpenseForm
          propertyId={propertyId}
          editing={formState === "edit" ? editingExpense : null}
          onDone={handleFormDone}
          onCancel={handleFormCancel}
        />
      )}

      {/* Monthly accordion */}
      {expenses.length === 0 && formState === "idle" ? (
        <p className="text-xs text-slate-400 text-center py-6">
          No cost entries yet. Add your first utility or expense.
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
  );
}
