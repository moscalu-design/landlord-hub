import { getMonthlyCostForMonth, type MortgageRecord } from "@/lib/mortgage";
import { getExpenseTotalForMonth, type ExpenseForCalc } from "@/lib/expenses";

export type ChartMonth = {
  label: string;
  costs: number;
  profit: number;
};

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function buildChartData(
  expenses: ExpenseForCalc[],
  payments: Array<{ periodYear: number; periodMonth: number; amountDue: number }>,
  mortgages: MortgageRecord[] = []
): ChartMonth[] {
  const now = new Date();

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    const expenseCosts = getExpenseTotalForMonth(expenses, year, month);

    const mortgageCosts = mortgages
      .reduce((sum, mortgage) => sum + getMonthlyCostForMonth(mortgage, year, month), 0);

    const costs = expenseCosts + mortgageCosts;

    const income = payments
      .filter((p) => p.periodYear === year && p.periodMonth === month)
      .reduce((sum, p) => sum + p.amountDue, 0);

    return {
      label: MONTH_SHORT[month - 1],
      costs,
      profit: income - costs,
    };
  });
}
