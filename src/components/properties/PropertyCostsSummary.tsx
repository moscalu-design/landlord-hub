import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

type Expense = {
  amount: number;
  category: string;
  reportingYear: number;
  reportingMonth: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICITY: "Electricity", GAS: "Gas", WATER: "Water", HEATING: "Heating",
  INTERNET: "Internet", INSURANCE: "Insurance", MAINTENANCE: "Maintenance",
  REPAIRS: "Repairs", CLEANING: "Cleaning", TAXES: "Taxes", OTHER: "Other",
};

export function PropertyCostsSummary({
  propertyId,
  expenses,
}: {
  propertyId: string;
  expenses: Expense[];
}) {
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  const thisMonthExpenses = expenses.filter(
    (e) => e.reportingYear === thisYear && e.reportingMonth === thisMonth
  );
  const thisYearExpenses = expenses.filter((e) => e.reportingYear === thisYear);

  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const thisYearTotal = thisYearExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Top category this month by total spend
  const categoryTotals: Record<string, number> = {};
  for (const e of thisMonthExpenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
  }
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  return (
    <div data-testid="property-costs-summary" className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-800">Costs</h2>
        <Link
          href={`/properties/${propertyId}/costs`}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-lg font-bold text-slate-900">{formatCurrency(thisMonthTotal)}</p>
          <p className="text-xs text-slate-500 mt-0.5">This month</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-lg font-bold text-slate-900">{formatCurrency(thisYearTotal)}</p>
          <p className="text-xs text-slate-500 mt-0.5">This year</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-lg font-bold text-slate-900 truncate">
            {topCategory ? CATEGORY_LABELS[topCategory[0]] ?? topCategory[0] : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Top cost this month</p>
        </div>
      </div>
    </div>
  );
}
