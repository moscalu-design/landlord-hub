"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createMortgage,
  createMortgagePrepayment,
  deleteMortgage,
  deleteMortgagePrepayment,
  toggleMortgageActive,
  toggleMortgagePrepaymentActive,
  updateMortgage,
  updateMortgagePrepayment,
} from "@/actions/mortgages";
import {
  calculateMortgageMonthlyPayment,
  getCurrentBalance,
  getElapsedTermMonths,
  getMonthlyCostForMonth,
  getMortgageAnnualData,
  getMortgageBalanceComparisonData,
  getMortgageMaturityDate,
  getMortgageOverview,
  getMortgageSchedule,
  normalizeMortgagePrepaymentType,
  normalizeMortgageType,
  simulateMortgageScenario,
  type MortgagePrepaymentRecord,
  type MortgageRecord,
  type MortgageScheduleMode,
  type MortgageSimulationMode,
  type MortgageSimulationScenario,
  type MortgageType,
  type ScheduleEntry,
} from "@/lib/mortgage";
import { formatCurrency, formatDate } from "@/lib/utils";

type Mortgage = MortgageRecord & {
  label: string | null;
  lender: string | null;
  notes: string | null;
  type: string | null;
  createdAt: Date;
  updatedAt: Date;
  prepayments?: MortgagePrepayment[];
};

type MortgagePrepayment = MortgagePrepaymentRecord & {
  createdAt: Date;
  updatedAt: Date;
};

type MortgageFormState = {
  label: string;
  lender: string;
  notes: string;
  type: MortgageType;
  startDate: string;
  termMonths: string;
  initialBalance: string;
  interestRate: string;
};

type PrepaymentFormState = {
  type: "one_off" | "recurring";
  amount: string;
  startDate: string;
  endDate: string;
  notes: string;
};

type SimulationFormState = {
  mode: MortgageSimulationMode;
  startDate: string;
  endDate: string;
  higherMonthlyPayment: string;
  lumpSumAmount: string;
  lumpSumDate: string;
  extraRecurringAmount: string;
};

type ChartTab = "annual" | "balance";
type OverlayMode = "baseline" | "actual" | "simulation";

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateInputString(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function formatRate(rate: number): string {
  return `${rate.toFixed(5).replace(/\.?0+$/, "")}%`;
}

function formatTerm(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}mo`;
  if (rem === 0) return `${years}yr`;
  return `${years}yr ${rem}mo`;
}

function formatMortgageType(type: string | null | undefined): string {
  return normalizeMortgageType(type) === "bullet" ? "Bullet" : "Amortizing";
}

function formatPrepaymentType(type: string | null | undefined): string {
  return normalizeMortgagePrepaymentType(type) === "recurring" ? "Recurring plan" : "One-off";
}

function formatMonthYear(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function toCsvValue(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function buildScheduleCsvRows(schedule: ScheduleEntry[]) {
  const header = [
    "Month",
    "Date",
    "Balance Before",
    "Recurring Payment",
    "Interest",
    "Scheduled Principal",
    "Extra Prepayment",
    "Principal",
    "Balloon Payment",
    "Total Payment",
    "Balance After",
  ];

  const rows = schedule.map((entry) => [
    entry.index + 1,
    dateInputString(entry.date),
    entry.balanceBefore.toFixed(2),
    entry.recurringPayment.toFixed(2),
    entry.interest.toFixed(2),
    entry.scheduledPrincipal.toFixed(2),
    entry.extraPrepayment.toFixed(2),
    entry.principal.toFixed(2),
    entry.balloonPayment.toFixed(2),
    entry.totalPayment.toFixed(2),
    entry.balanceAfter.toFixed(2),
  ]);

  return [header, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
}

function getDefaultFormState(mortgage?: Mortgage): MortgageFormState {
  if (!mortgage) {
    return {
      label: "",
      lender: "",
      notes: "",
      type: "amortizing",
      startDate: todayString(),
      termMonths: "",
      initialBalance: "",
      interestRate: "",
    };
  }

  return {
    label: mortgage.label ?? "",
    lender: mortgage.lender ?? "",
    notes: mortgage.notes ?? "",
    type: normalizeMortgageType(mortgage.type),
    startDate: dateInputString(mortgage.startDate),
    termMonths: String(mortgage.termMonths),
    initialBalance: String(mortgage.initialBalance),
    interestRate: String(mortgage.interestRate),
  };
}

function getDefaultPrepaymentFormState(
  prepayment?: MortgagePrepayment
): PrepaymentFormState {
  return {
    type: normalizeMortgagePrepaymentType(prepayment?.type),
    amount: prepayment ? String(prepayment.amount) : "",
    startDate: prepayment ? dateInputString(prepayment.startDate) : todayString(),
    endDate: prepayment?.endDate ? dateInputString(prepayment.endDate) : "",
    notes: prepayment?.notes ?? "",
  };
}

function getDefaultSimulationState(mortgage: Mortgage): SimulationFormState {
  return {
    mode: "recurring_extra",
    startDate: todayString(),
    endDate: "",
    higherMonthlyPayment: String(Math.round((mortgage.monthlyPayment + 100) * 100) / 100),
    lumpSumAmount: "",
    lumpSumDate: todayString(),
    extraRecurringAmount: "100",
  };
}

function getCalculatedPayment(state: MortgageFormState): number | null {
  const principal = Number(state.initialBalance);
  const interestRate = Number(state.interestRate);
  const termMonths = Number(state.termMonths);

  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) return null;
  if (!Number.isFinite(termMonths) || termMonths <= 0) return null;

  const payment = calculateMortgageMonthlyPayment({
    type: state.type,
    principal,
    annualInterestRate: interestRate,
    termMonths,
  });

  return payment > 0 || state.type === "bullet" ? payment : null;
}

function toMortgageFormData(state: MortgageFormState): FormData {
  const formData = new FormData();
  formData.set("label", state.label);
  formData.set("lender", state.lender);
  formData.set("notes", state.notes);
  formData.set("type", state.type);
  formData.set("startDate", state.startDate);
  formData.set("termMonths", state.termMonths);
  formData.set("initialBalance", state.initialBalance);
  formData.set("interestRate", state.interestRate);
  return formData;
}

function toPrepaymentFormData(state: PrepaymentFormState): FormData {
  const formData = new FormData();
  formData.set("type", state.type);
  formData.set("amount", state.amount);
  formData.set("startDate", state.startDate);
  if (state.endDate) formData.set("endDate", state.endDate);
  if (state.type === "recurring") formData.set("frequency", "monthly");
  formData.set("notes", state.notes);
  return formData;
}

function getSimulationScenario(
  mortgage: Mortgage,
  state: SimulationFormState
): MortgageSimulationScenario | null {
  const startDate = state.startDate ? new Date(state.startDate) : null;
  if (!startDate) return null;

  if (state.mode === "higher_payment") {
    const higherMonthlyPayment = Number(state.higherMonthlyPayment);
    if (!Number.isFinite(higherMonthlyPayment) || higherMonthlyPayment < mortgage.monthlyPayment) {
      return null;
    }
    return {
      mode: "higher_payment",
      startDate,
      endDate: state.endDate ? new Date(state.endDate) : null,
      higherMonthlyPayment,
    };
  }

  if (state.mode === "lump_sum") {
    const lumpSumAmount = Number(state.lumpSumAmount);
    const lumpSumDate = state.lumpSumDate ? new Date(state.lumpSumDate) : null;
    if (!Number.isFinite(lumpSumAmount) || lumpSumAmount <= 0 || !lumpSumDate) return null;
    return {
      mode: "lump_sum",
      startDate,
      lumpSumAmount,
      lumpSumDate,
    };
  }

  const extraRecurringAmount = Number(state.extraRecurringAmount);
  if (!Number.isFinite(extraRecurringAmount) || extraRecurringAmount <= 0) return null;
  return {
    mode: "recurring_extra",
    startDate,
    endDate: state.endDate ? new Date(state.endDate) : null,
    extraRecurringAmount,
  };
}

function yFmt(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(0)}k`;
  return `€${Math.round(value)}`;
}

function DetailsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload
        .filter((entry) => typeof entry.value === "number")
        .map((entry) => (
          <div key={`${entry.name}-${entry.color}`} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ background: entry.color || "#94a3b8" }}
            />
            <span className="text-slate-500 capitalize">{entry.name}:</span>
            <span
              className="font-medium ml-auto pl-3"
              style={{ color: entry.color || "#0f172a" }}
            >
              {formatCurrency(entry.value ?? 0)}
            </span>
          </div>
        ))}
    </div>
  );
}

function MortgageFormFields({
  state,
  onChange,
}: {
  state: MortgageFormState;
  onChange: (field: keyof MortgageFormState, value: string) => void;
}) {
  const calculatedPayment = getCalculatedPayment(state);
  const isBullet = state.type === "bullet";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Mortgage Name <span className="text-red-400">*</span>
          </label>
          <input
            name="label"
            type="text"
            value={state.label}
            onChange={(e) => onChange("label", e.target.value)}
            placeholder="e.g. Main Mortgage"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Mortgage Type <span className="text-red-400">*</span>
          </label>
          <select
            name="type"
            value={state.type}
            onChange={(e) => onChange("type", e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="amortizing">Standard amortizing</option>
            <option value="bullet">Bullet mortgage</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Start Date <span className="text-red-400">*</span>
          </label>
          <input
            name="startDate"
            type="date"
            value={state.startDate}
            onChange={(e) => onChange("startDate", e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">First payment month</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Duration (months) <span className="text-red-400">*</span>
          </label>
          <input
            name="termMonths"
            type="number"
            min={1}
            max={600}
            value={state.termMonths}
            onChange={(e) => onChange("termMonths", e.target.value)}
            placeholder="e.g. 300"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Principal (€) <span className="text-red-400">*</span>
          </label>
          <input
            name="initialBalance"
            type="number"
            min={0.01}
            step="0.01"
            value={state.initialBalance}
            onChange={(e) => onChange("initialBalance", e.target.value)}
            placeholder="200000"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Interest Rate (%) <span className="text-red-400">*</span>
          </label>
          <input
            name="interestRate"
            type="number"
            min={0}
            max={100}
            step="0.00001"
            value={state.interestRate}
            onChange={(e) => onChange("interestRate", e.target.value)}
            placeholder="3.125"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">Up to 5 decimals</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {isBullet ? "Monthly interest-only payment" : "Calculated monthly payment"}
          </label>
          <input
            name="monthlyPaymentDisplay"
            type="text"
            value={calculatedPayment === null ? "" : formatCurrency(calculatedPayment)}
            placeholder={
              isBullet
                ? "Calculated from principal and rate"
                : "Calculated from principal, rate, and term"
            }
            readOnly
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 focus:outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">
            {isBullet
              ? "Balloon principal is repaid at maturity"
              : "This stays read-only so the baseline schedule stays deterministic"}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Lender <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          name="lender"
          type="text"
          value={state.lender}
          onChange={(e) => onChange("lender", e.target.value)}
          placeholder="e.g. Nationwide"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          name="notes"
          value={state.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          rows={3}
          placeholder="Anything important about this facility, repayment strategy, or maturity."
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}

function MortgageEditorModal({
  propertyId,
  mortgage,
  onClose,
}: {
  propertyId: string;
  mortgage?: Mortgage;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState(getDefaultFormState(mortgage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(mortgage);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  function updateField(field: keyof MortgageFormState, value: string) {
    setState((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const formData = toMortgageFormData(state);
      if (mortgage) {
        await updateMortgage(mortgage.id, propertyId, formData);
      } else {
        await createMortgage(propertyId, formData);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mortgage");
      setSaving(false);
    }
  }

  return (
    <div
      data-testid={isEditing ? "mortgage-edit-modal" : "mortgage-add-modal"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              {isEditing ? "Edit Mortgage" : "Add Mortgage"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Baseline mortgage terms define the contractual schedule. Prepayments stay separate.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <MortgageFormFields state={state} onChange={updateField} />

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Mortgage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PrepaymentEditorModal({
  propertyId,
  mortgage,
  prepayment,
  onClose,
}: {
  propertyId: string;
  mortgage: Mortgage;
  prepayment?: MortgagePrepayment;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState(getDefaultPrepaymentFormState(prepayment));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  function updateField(field: keyof PrepaymentFormState, value: string) {
    setState((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const formData = toPrepaymentFormData(state);
      if (prepayment) {
        await updateMortgagePrepayment(prepayment.id, propertyId, formData);
      } else {
        await createMortgagePrepayment(mortgage.id, propertyId, formData);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prepayment");
      setSaving(false);
    }
  }

  return (
    <div
      data-testid={prepayment ? "mortgage-prepayment-edit-modal" : "mortgage-prepayment-modal"}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              {prepayment ? "Edit Prepayment" : "Record Prepayment"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Saved prepayments change the real mortgage path and property cash flow.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select
              value={state.type}
              onChange={(e) => updateField("type", e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="one_off">One-off prepayment</option>
              <option value="recurring">Recurring prepayment plan</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Amount (€)
              </label>
              <input
                data-testid="mortgage-prepayment-amount-input"
                type="number"
                min={0.01}
                step="0.01"
                value={state.amount}
                onChange={(e) => updateField("amount", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Effective Month
              </label>
              <input
                data-testid="mortgage-prepayment-start-date"
                type="date"
                value={state.startDate}
                onChange={(e) => updateField("startDate", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {state.type === "recurring" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                End Month <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                data-testid="mortgage-prepayment-end-date"
                type="date"
                value={state.endDate}
                onChange={(e) => updateField("endDate", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Recurs monthly until this date. Leave blank to continue until payoff.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={state.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : prepayment ? "Save Changes" : "Record Prepayment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SimulationPanel({
  mortgage,
  propertyId,
  state,
  onChange,
}: {
  mortgage: Mortgage;
  propertyId: string;
  state: SimulationFormState;
  onChange: (field: keyof SimulationFormState, value: string) => void;
}) {
  const router = useRouter();
  const [applying, setApplying] = useState(false);
  const scenario = getSimulationScenario(mortgage, state);
  const simulation = scenario ? simulateMortgageScenario(mortgage, scenario) : null;
  const baselineOverview = getMortgageOverview(mortgage, "baseline");
  const actualOverview = getMortgageOverview(mortgage, "actual");

  async function applySimulation() {
    if (!scenario || !simulation) return;
    if (!confirm("Apply this simulation as a real saved prepayment plan?")) return;

    const formData = new FormData();

    if (scenario.mode === "higher_payment") {
      const extraAmount = Math.max(
        0,
        (scenario.higherMonthlyPayment ?? mortgage.monthlyPayment) - mortgage.monthlyPayment
      );
      if (extraAmount <= 0) return;
      formData.set("type", "recurring");
      formData.set("amount", String(extraAmount));
      formData.set("startDate", dateInputString(scenario.startDate));
      if (scenario.endDate) formData.set("endDate", dateInputString(scenario.endDate));
      formData.set("frequency", "monthly");
      formData.set("notes", "Applied from higher-payment simulation");
    } else if (scenario.mode === "lump_sum") {
      formData.set("type", "one_off");
      formData.set("amount", String(scenario.lumpSumAmount ?? 0));
      formData.set("startDate", dateInputString(scenario.lumpSumDate ?? scenario.startDate));
      formData.set("notes", "Applied from lump-sum simulation");
    } else {
      formData.set("type", "recurring");
      formData.set("amount", String(scenario.extraRecurringAmount ?? 0));
      formData.set("startDate", dateInputString(scenario.startDate));
      if (scenario.endDate) formData.set("endDate", dateInputString(scenario.endDate));
      formData.set("frequency", "monthly");
      formData.set("notes", "Applied from recurring-extra simulation");
    }

    setApplying(true);
    await createMortgagePrepayment(mortgage.id, propertyId, formData);
    router.refresh();
    setApplying(false);
  }

  return (
    <div data-testid="mortgage-simulation-panel" className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Simulation</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Baseline stays contractual. This overlay is hypothetical until you explicitly apply it.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Simulation type</label>
          <select
            data-testid="mortgage-simulation-type"
            value={state.mode}
            onChange={(e) => onChange("mode", e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recurring_extra">Recurring extra prepayment</option>
            <option value="lump_sum">One-off lump sum prepayment</option>
            <option value="higher_payment">Higher total monthly payment</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Start month</label>
          <input
            data-testid="mortgage-simulation-start-date"
            type="date"
            value={state.startDate}
            onChange={(e) => onChange("startDate", e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {state.mode === "higher_payment" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              New monthly payment
            </label>
            <input
              data-testid="mortgage-overpayment-input"
              type="number"
              min={mortgage.monthlyPayment}
              step="0.01"
              value={state.higherMonthlyPayment}
              onChange={(e) => onChange("higherMonthlyPayment", e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Baseline is {formatCurrency(mortgage.monthlyPayment)}.
            </p>
          </div>
        )}
        {state.mode === "lump_sum" && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Lump-sum amount
              </label>
              <input
                data-testid="mortgage-lump-sum-input"
                type="number"
                min={0.01}
                step="0.01"
                value={state.lumpSumAmount}
                onChange={(e) => onChange("lumpSumAmount", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Lump-sum month
              </label>
              <input
                data-testid="mortgage-lump-sum-date"
                type="date"
                value={state.lumpSumDate}
                onChange={(e) => onChange("lumpSumDate", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
        {state.mode === "recurring_extra" && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Extra per month
              </label>
              <input
                data-testid="mortgage-recurring-extra-input"
                type="number"
                min={0.01}
                step="0.01"
                value={state.extraRecurringAmount}
                onChange={(e) => onChange("extraRecurringAmount", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Optional end month
              </label>
              <input
                data-testid="mortgage-simulation-end-date"
                type="date"
                value={state.endDate}
                onChange={(e) => onChange("endDate", e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}
      </div>

      {!simulation && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
          Enter a valid scenario. Higher monthly payments must be at least the baseline.
        </p>
      )}

      {simulation && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatMonthYear(simulation.simulatedPayoffDate)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Simulated payoff</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-lg font-bold text-slate-900">{simulation.monthsSaved}</p>
              <p className="text-xs text-slate-500 mt-0.5">Months saved</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-lg font-bold text-emerald-600">
                {formatCurrency(simulation.interestSavings)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Interest saved</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(simulation.totalExtraCashPaid)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Total extra cash paid</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="font-semibold text-slate-700 mb-2">Current actual path</p>
              <div className="space-y-1.5 text-slate-500">
                <div className="flex justify-between gap-4">
                  <span>Payoff</span>
                  <span className="font-medium text-slate-800">
                    {formatMonthYear(actualOverview.payoffDate)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Interest remaining</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(actualOverview.totalProjectedInterestRemaining)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Baseline-only payoff</span>
                  <span className="font-medium text-slate-800">
                    {formatMonthYear(baselineOverview.payoffDate)}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-white border border-blue-200 rounded-xl px-4 py-3">
              <p className="font-semibold text-blue-700 mb-2">Simulation result</p>
              <div className="space-y-1.5 text-slate-500">
                <div className="flex justify-between gap-4">
                  <span>Simulated payoff</span>
                  <span className="font-medium text-slate-800">
                    {formatMonthYear(simulation.simulatedPayoffDate)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Interest remaining</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(simulation.simulatedRemainingInterest)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Applied mode</span>
                  <span className="font-medium text-slate-800">
                    {state.mode === "higher_payment"
                      ? "Higher payment"
                      : state.mode === "lump_sum"
                        ? "Lump sum"
                        : "Recurring extra"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              data-testid="apply-simulation-button"
              type="button"
              onClick={applySimulation}
              disabled={applying}
              className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              {applying ? "Applying…" : "Apply as Actual Prepayment Plan"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PrepaymentHistory({
  mortgage,
  propertyId,
  onEdit,
}: {
  mortgage: Mortgage;
  propertyId: string;
  onEdit: (prepayment: MortgagePrepayment) => void;
}) {
  const router = useRouter();
  const prepayments = (mortgage.prepayments ?? []) as MortgagePrepayment[];

  async function handleDelete(prepayment: MortgagePrepayment) {
    if (!confirm("Delete this prepayment record?")) return;
    await deleteMortgagePrepayment(prepayment.id, propertyId);
    router.refresh();
  }

  async function handleToggle(prepayment: MortgagePrepayment) {
    await toggleMortgagePrepaymentActive(prepayment.id, propertyId, !prepayment.isActive);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-700">Actual prepayment history</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real extra payments and recurring plans that alter the effective schedule.
          </p>
        </div>
      </div>

      {prepayments.length === 0 ? (
        <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-400">
          No actual prepayments recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {prepayments.map((prepayment) => (
            <div
              key={prepayment.id}
              data-testid={`mortgage-prepayment-row-${prepayment.id}`}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800">
                      {formatPrepaymentType(prepayment.type)}
                    </p>
                    <span className="text-[11px] uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {prepayment.isActive ? "active" : "inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatCurrency(prepayment.amount)}
                    {normalizeMortgagePrepaymentType(prepayment.type) === "recurring"
                      ? " / month"
                      : ""}
                    {" · "}
                    starts {formatDate(prepayment.startDate)}
                    {prepayment.endDate ? ` · ends ${formatDate(prepayment.endDate)}` : ""}
                  </p>
                  {prepayment.notes && (
                    <p className="text-xs text-slate-400 mt-1">{prepayment.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <button
                    onClick={() => onEdit(prepayment)}
                    className="text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggle(prepayment)}
                    className="text-slate-500 hover:text-slate-700 font-medium"
                  >
                    {prepayment.isActive ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => handleDelete(prepayment)}
                    className="text-red-500 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MortgageDetailsModal({
  mortgage,
  propertyId,
  onClose,
  onEdit,
  embedded = false,
  closeLabel = "×",
}: {
  mortgage: Mortgage;
  propertyId: string;
  onClose: () => void;
  onEdit: () => void;
  embedded?: boolean;
  closeLabel?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showSimulation, setShowSimulation] = useState(false);
  const [showPrepaymentModal, setShowPrepaymentModal] = useState(false);
  const [editingPrepayment, setEditingPrepayment] = useState<MortgagePrepayment | undefined>();
  const [chartTab, setChartTab] = useState<ChartTab>("annual");
  const [annualMode, setAnnualMode] = useState<OverlayMode>("actual");
  const [simulationState, setSimulationState] = useState(() => getDefaultSimulationState(mortgage));
  const [showBaselineLine, setShowBaselineLine] = useState(true);
  const [showActualLine, setShowActualLine] = useState(true);
  const [showSimulationLine, setShowSimulationLine] = useState(true);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  const scenario = getSimulationScenario(mortgage, simulationState);
  const actualOverview = getMortgageOverview(mortgage, "actual");
  const baselineOverview = getMortgageOverview(mortgage, "baseline");
  const schedule = getMortgageSchedule(mortgage, "actual");
  const type = normalizeMortgageType(mortgage.type);
  const hasActualPrepayments = (mortgage.prepayments?.length ?? 0) > 0;
  const effectiveAnnualMode =
    !hasActualPrepayments && annualMode === "actual" ? "baseline" : annualMode;
  const balanceData = useMemo(
    () => getMortgageBalanceComparisonData(mortgage, scenario),
    [mortgage, scenario]
  );
  const annualData = useMemo(() => {
    const mode: MortgageScheduleMode =
      effectiveAnnualMode === "simulation" ? "simulation" : effectiveAnnualMode;
    return getMortgageAnnualData(
      mortgage,
      mode,
      effectiveAnnualMode === "simulation" ? scenario : undefined
    );
  }, [effectiveAnnualMode, mortgage, scenario]);
  const simulation = scenario ? simulateMortgageScenario(mortgage, scenario) : null;
  const balloonExcluded = annualData.some((entry) => entry.balloonPrincipalExcluded > 0);

  function updateSimulationField(field: keyof SimulationFormState, value: string) {
    setSimulationState((current) => ({ ...current, [field]: value }));
  }

  function handleExportCsv() {
    const csv = buildScheduleCsvRows(schedule);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (mortgage.label || mortgage.lender || "mortgage")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    link.href = url;
    link.download = `${safeName || "mortgage"}-schedule.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!confirm("Remove this mortgage? This cannot be undone.")) return;
    setDeleting(true);
    await deleteMortgage(mortgage.id, propertyId);
    router.refresh();
    onClose();
  }

  async function handleToggle() {
    setToggling(true);
    await toggleMortgageActive(mortgage.id, propertyId, !mortgage.isActive);
    router.refresh();
    onClose();
  }

  const content = (
    <>
      <div
        data-testid={embedded ? "mortgage-details-page" : "mortgage-details-modal"}
        className={`w-full ${embedded ? "" : "max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"}`}
        onClick={(e) => {
          if (!embedded) e.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-slate-800">
                {mortgage.label || mortgage.lender || "Mortgage"}
              </h2>
              <span className="text-[11px] uppercase tracking-wide bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {formatMortgageType(mortgage.type)}
              </span>
              {!mortgage.isActive && (
                <span className="text-[11px] uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  inactive
                </span>
              )}
            </div>
            {mortgage.lender && (
              <p className="text-xs text-slate-400 mt-0.5">{mortgage.lender}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
            >
              Export CSV
            </button>
            <button
              onClick={onEdit}
              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors shadow-sm"
            >
              Edit Mortgage
            </button>
            <button
              onClick={onClose}
              className={`${embedded ? "text-xs text-slate-500 hover:text-slate-700 font-medium border border-slate-200 rounded-lg px-3 py-2" : "text-slate-400 hover:text-slate-600 text-lg leading-none mt-0.5"}`}
            >
              {closeLabel}
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(mortgage.monthlyPayment)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Monthly payment</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(actualOverview.currentBalance)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Current remaining balance</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-lg font-bold text-slate-900">{formatRate(mortgage.interestRate)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Interest rate</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatMonthYear(actualOverview.payoffDate)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Estimated payoff date</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-lg font-bold text-slate-900">
                {formatCurrency(actualOverview.totalProjectedInterestRemaining)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Projected interest remaining</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-slate-400">Started</p>
              <p className="font-medium text-slate-800 mt-1">{formatDate(mortgage.startDate)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-slate-400">Maturity</p>
              <p className="font-medium text-slate-800 mt-1">
                {formatMonthYear(actualOverview.maturityDate)}
              </p>
            </div>
            {hasActualPrepayments && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-slate-400">Baseline payoff</p>
                <p className="font-medium text-slate-800 mt-1">
                  {formatMonthYear(baselineOverview.payoffDate)}
                </p>
              </div>
            )}
            {hasActualPrepayments && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-slate-400">Prepayments</p>
                <p className="font-medium text-slate-800 mt-1">
                  {mortgage.prepayments?.length ?? 0}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="open-simulation-button"
              onClick={() => setShowSimulation((current) => !current)}
              className={`text-xs font-medium rounded-lg px-3 py-2 transition-colors ${
                showSimulation
                  ? "border border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                  : "border border-slate-200 text-slate-700 hover:text-slate-900"
              }`}
            >
              {showSimulation ? "Simulation On" : "Run Simulation"}
            </button>
            <button
              type="button"
              data-testid="record-prepayment-button"
              onClick={() => {
                setEditingPrepayment(undefined);
                setShowPrepaymentModal(true);
              }}
              className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg px-3 py-2 transition-colors shadow-sm"
            >
              Record Prepayment
            </button>
          </div>

          {showSimulation && (
            <SimulationPanel
              mortgage={mortgage}
              propertyId={propertyId}
              state={simulationState}
              onChange={updateSimulationField}
            />
          )}

          {type === "bullet" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
              Bullet mortgage charts default to readable recurring cash flow. The final balloon
              principal repayment still exists in the model and property cost engine, but the annual
              chart suppresses that balloon from the default bars so one maturity event does not
              flatten the rest of the timeline.
            </div>
          )}

          <div className="border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-700">Mortgage analysis</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Baseline is contractual. Actual includes saved prepayments. Simulation is hypothetical.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setChartTab("annual")}
                  className={`px-3 py-1.5 rounded-lg border ${
                    chartTab === "annual"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  Annual payment breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab("balance")}
                  className={`px-3 py-1.5 rounded-lg border ${
                    chartTab === "balance"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  Remaining balance over time
                </button>
              </div>
            </div>

            {chartTab === "annual" ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAnnualMode("baseline")}
                    className={`px-3 py-1.5 rounded-lg border ${
                      effectiveAnnualMode === "baseline"
                        ? "border-slate-300 bg-slate-100 text-slate-700"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    Baseline
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnualMode("actual")}
                    className={`px-3 py-1.5 rounded-lg border ${
                      effectiveAnnualMode === "actual"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    Actual
                  </button>
                  {simulation && (
                    <button
                      type="button"
                      onClick={() => setAnnualMode("simulation")}
                      className={`px-3 py-1.5 rounded-lg border ${
                        effectiveAnnualMode === "simulation"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-500"
                      }`}
                    >
                      Simulation
                    </button>
                  )}
                </div>

                <div
                  data-testid="mortgage-details-chart"
                  data-annual-series={JSON.stringify(annualData)}
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={annualData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        dy={6}
                      />
                      <YAxis
                        tickFormatter={yFmt}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                      />
                      <Tooltip content={<DetailsTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Bar
                        dataKey="chartPrincipal"
                        name="principal"
                        stackId="payments"
                        fill="#60a5fa"
                        opacity={0.9}
                        maxBarSize={32}
                      />
                      <Bar
                        dataKey="totalInterest"
                        name="interest"
                        stackId="payments"
                        fill="#fbbf24"
                        opacity={0.85}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={32}
                      />
                      <Bar
                        dataKey="extraPrepayments"
                        name="extra prepayments"
                        stackId="payments"
                        fill="#34d399"
                        opacity={0.8}
                        maxBarSize={32}
                      />
                      <Line
                        type="monotone"
                        dataKey="endBalance"
                        name="balance"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#94a3b8", strokeWidth: 0 }}
                        activeDot={{ r: 4, fill: "#94a3b8", strokeWidth: 0 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {balloonExcluded && (
                  <p className="text-xs text-slate-400">
                    Chart note: balloon principal is excluded from the default bar stack for readability,
                    but it still affects the saved schedule and property cash-flow model.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showBaselineLine}
                      onChange={(e) => setShowBaselineLine(e.target.checked)}
                    />
                    <span className="text-slate-600">Baseline</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showActualLine}
                      onChange={(e) => setShowActualLine(e.target.checked)}
                    />
                    <span className="text-slate-600">Actual</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showSimulationLine}
                      onChange={(e) => setShowSimulationLine(e.target.checked)}
                      disabled={!simulation}
                    />
                    <span className="text-slate-600">Simulation</span>
                  </label>
                </div>

                <div
                  data-testid="mortgage-balance-chart"
                  data-balance-series={JSON.stringify(balanceData)}
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={balanceData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        dy={6}
                      />
                      <YAxis
                        tickFormatter={yFmt}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                      />
                      <Tooltip content={<DetailsTooltip />} />
                      {showBaselineLine && (
                        <Line
                          type="monotone"
                          dataKey="baselineBalance"
                          name="baseline"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                      {showActualLine && (
                        <Line
                          type="monotone"
                          dataKey="actualBalance"
                          name="actual"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                      {showSimulationLine && simulation && (
                        <Line
                          type="monotone"
                          dataKey="simulatedBalance"
                          name="simulation"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-xs text-slate-400">
                  The balance chart compares the contractual path, the real saved schedule with actual
                  prepayments, and the current hypothetical simulation when enabled.
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">Lifecycle</p>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <div className="flex justify-between gap-4">
                  <span>Mortgage created</span>
                  <span className="font-medium text-slate-800">{formatDate(mortgage.createdAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Last edited</span>
                  <span className="font-medium text-slate-800">{formatDate(mortgage.updatedAt)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Term</span>
                  <span className="font-medium text-slate-800">{formatTerm(mortgage.termMonths)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Current-month real cash cost</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(
                      getMonthlyCostForMonth(
                        mortgage,
                        new Date().getFullYear(),
                        new Date().getMonth() + 1
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            {mortgage.notes && (
              <div className="bg-slate-50 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-slate-700">Notes</p>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{mortgage.notes}</p>
              </div>
            )}
          </div>

          <PrepaymentHistory
            mortgage={mortgage}
            propertyId={propertyId}
            onEdit={(prepayment) => {
              setEditingPrepayment(prepayment);
              setShowPrepaymentModal(true);
            }}
          />

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? "Removing…" : "Remove mortgage"}
            </button>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              {mortgage.isActive ? "Mark as inactive" : "Mark as active"}
            </button>
          </div>
        </div>
      </div>

      {showPrepaymentModal && (
        <PrepaymentEditorModal
          propertyId={propertyId}
          mortgage={mortgage}
          prepayment={editingPrepayment}
          onClose={() => {
            setShowPrepaymentModal(false);
            setEditingPrepayment(undefined);
          }}
        />
      )}
    </>
  );

  if (embedded) {
    return <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">{content}</div>;
  }

  return (
    <div
      data-testid="mortgage-details-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      {content}
    </div>
  );
}

function MortgageCard({
  mortgage,
  propertyId,
  detailsHref,
}: {
  mortgage: Mortgage;
  propertyId: string;
  detailsHref?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const currentBalance = getCurrentBalance(mortgage, "actual");
  const elapsed = getElapsedTermMonths(mortgage);
  const progressPct = mortgage.termMonths > 0
    ? Math.round((elapsed / mortgage.termMonths) * 100)
    : 0;
  const maturityDate = getMortgageMaturityDate(mortgage, "actual");
  const type = normalizeMortgageType(mortgage.type);

  return (
    <>
      <div className={`bg-white border rounded-xl px-5 py-4 ${mortgage.isActive ? "border-slate-200" : "border-slate-100 opacity-60"}`}>
        <div data-testid={`mortgage-card-${mortgage.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {mortgage.label || mortgage.lender || "Mortgage"}
                </p>
                <span className="text-[11px] uppercase tracking-wide bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {formatMortgageType(mortgage.type)}
                </span>
                {!mortgage.isActive && (
                  <span className="text-[11px] uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {formatDate(mortgage.startDate)} to {formatMonthYear(maturityDate)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium"
              >
                Edit
              </button>
              {detailsHref ? (
                <Link
                  href={detailsHref}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Details
                </Link>
              ) : (
                <button
                  onClick={() => setShowDetails(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Details
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {formatCurrency(mortgage.monthlyPayment)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {type === "bullet" ? "interest / month" : "baseline / month"}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {formatCurrency(currentBalance)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">remaining balance</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{formatRate(mortgage.interestRate)}</p>
              <p className="text-xs text-slate-400 mt-0.5">annual rate</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {(mortgage.prepayments?.length ?? 0) > 0 ? mortgage.prepayments?.length : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">actual prepayments</p>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {progressPct}% elapsed · {formatTerm(Math.max(0, mortgage.termMonths - elapsed))} remaining
            </p>
          </div>
        </div>
      </div>

      {showDetails && (
        <MortgageDetailsModal
          mortgage={mortgage}
          propertyId={propertyId}
          onClose={() => setShowDetails(false)}
          onEdit={() => {
            setShowDetails(false);
            setShowEdit(true);
          }}
        />
      )}

      {showEdit && (
        <MortgageEditorModal
          propertyId={propertyId}
          mortgage={mortgage}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}

export function MortgagesSection({
  propertyId,
  mortgages,
  detailsBasePath,
}: {
  propertyId: string;
  mortgages: Mortgage[];
  detailsBasePath?: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const now = new Date();
  const currentMonthCost = mortgages
    .filter((mortgage) => mortgage.isActive)
    .reduce(
      (sum, mortgage) =>
        sum + getMonthlyCostForMonth(mortgage, now.getFullYear(), now.getMonth() + 1),
      0
    );
  const bulletCount = mortgages.filter(
    (mortgage) => normalizeMortgageType(mortgage.type) === "bullet"
  ).length;

  return (
    <>
      <div data-testid="mortgages-section">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Mortgages</h2>
            {mortgages.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {formatCurrency(currentMonthCost)} current-month financing cost across{" "}
                {mortgages.filter((mortgage) => mortgage.isActive).length} active
                {bulletCount > 0 ? ` · ${bulletCount} bullet` : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Mortgage
          </button>
        </div>

        {mortgages.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-6 text-center">
            <p className="text-xs text-slate-400">No mortgages recorded.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Add first mortgage →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {mortgages.map((mortgage) => (
              <MortgageCard
                key={mortgage.id}
                mortgage={mortgage}
                propertyId={propertyId}
                detailsHref={detailsBasePath ? `${detailsBasePath}/${mortgage.id}` : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <MortgageEditorModal propertyId={propertyId} onClose={() => setShowAdd(false)} />
      )}
    </>
  );
}

export function MortgageDetailView({
  propertyId,
  mortgage,
  backHref,
  backLabel = "Back to Mortgages",
}: {
  propertyId: string;
  mortgage: Mortgage;
  backHref: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);

  return (
    <>
      <MortgageDetailsModal
        mortgage={mortgage}
        propertyId={propertyId}
        embedded
        closeLabel={backLabel}
        onClose={() => router.push(backHref)}
        onEdit={() => setShowEdit(true)}
      />

      {showEdit && (
        <MortgageEditorModal
          propertyId={propertyId}
          mortgage={mortgage}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
