/**
 * Expense calculation helpers.
 *
 * Distinguishes two kinds of PropertyExpense:
 *   - ONE_OFF: a single payment, counted by reportingYear/Month
 *   - Recurring (MONTHLY / QUARTERLY / ANNUAL) with coverageStart set:
 *     counted for every month that falls within the coverage range
 *
 * Old ONE_OFF entries with a recurrenceType label but no coverageStart
 * fall back to the reportingYear/Month path — backward compatible.
 */

export type ExpenseForCalc = {
  amount: number;
  category: string;
  recurrenceType: string;
  reportingYear: number;
  reportingMonth: number;
  coverageStart: Date | null;
  coverageEnd: Date | null;
};

/** True if this expense is a recurring cost definition (not a one-off payment). */
export function isRecurring(e: Pick<ExpenseForCalc, "recurrenceType" | "coverageStart">): boolean {
  return e.recurrenceType !== "ONE_OFF" && e.coverageStart !== null;
}

/** True if a recurring expense is active during the given year/month. */
export function isRecurringActiveInMonth(
  e: Pick<ExpenseForCalc, "recurrenceType" | "coverageStart" | "coverageEnd">,
  year: number,
  month: number
): boolean {
  if (!e.coverageStart) return false;

  const start = new Date(e.coverageStart);
  const sy = start.getFullYear();
  const sm = start.getMonth() + 1;

  // Must be on or after start
  if (year < sy || (year === sy && month < sm)) return false;

  // Must be on or before end (if present)
  if (e.coverageEnd) {
    const end = new Date(e.coverageEnd);
    const ey = end.getFullYear();
    const em = end.getMonth() + 1;
    if (year > ey || (year === ey && month > em)) return false;
  }

  if (e.recurrenceType === "MONTHLY") return true;

  if (e.recurrenceType === "QUARTERLY") {
    const diff = (year - sy) * 12 + (month - sm);
    return diff % 3 === 0;
  }

  if (e.recurrenceType === "ANNUAL") {
    return month === sm;
  }

  return false;
}

/**
 * Total expense cost attributed to a specific year/month.
 * ONE_OFF: uses reportingYear/Month.
 * Recurring: uses coverageStart–coverageEnd range.
 */
export function getExpenseTotalForMonth(expenses: ExpenseForCalc[], year: number, month: number): number {
  let total = 0;
  for (const e of expenses) {
    if (isRecurring(e)) {
      if (isRecurringActiveInMonth(e, year, month)) total += e.amount;
    } else {
      if (e.reportingYear === year && e.reportingMonth === month) total += e.amount;
    }
  }
  return total;
}

/**
 * Sum of recurring monthly costs active in the given month.
 * Used to show the "Recurring/mo" stat on the Overview.
 */
export function getRecurringMonthlyTotal(expenses: ExpenseForCalc[], year: number, month: number): number {
  return expenses
    .filter((e) => e.recurrenceType === "MONTHLY" && isRecurring(e) && isRecurringActiveInMonth(e, year, month))
    .reduce((sum, e) => sum + e.amount, 0);
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type CostCategoryPoint = {
  label: string;
  electricity: number;
  water: number;
  other: number;
};

/**
 * Build 12-month stacked data for the costs category chart.
 * Buckets: Electricity | Water | Other (everything else, no mortgage).
 */
export function buildCostCategoryChartData(expenses: ExpenseForCalc[]): CostCategoryPoint[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    let electricity = 0;
    let water = 0;
    let other = 0;

    for (const e of expenses) {
      const amount = isRecurring(e)
        ? isRecurringActiveInMonth(e, year, month)
          ? e.amount
          : 0
        : e.reportingYear === year && e.reportingMonth === month
        ? e.amount
        : 0;

      if (amount === 0) continue;

      if (e.category === "ELECTRICITY") electricity += amount;
      else if (e.category === "WATER") water += amount;
      else other += amount;
    }

    return { label: MONTH_SHORT[month - 1], electricity, water, other };
  });
}
