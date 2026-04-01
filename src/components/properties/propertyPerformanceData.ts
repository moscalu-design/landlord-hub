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
  expenses: Array<{ reportingYear: number; reportingMonth: number; amount: number }>,
  payments: Array<{ periodYear: number; periodMonth: number; amountDue: number }>
): ChartMonth[] {
  const now = new Date();

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    const costs = expenses
      .filter((expense) => expense.reportingYear === year && expense.reportingMonth === month)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const income = payments
      .filter((payment) => payment.periodYear === year && payment.periodMonth === month)
      .reduce((sum, payment) => sum + payment.amountDue, 0);

    return {
      label: MONTH_SHORT[month - 1],
      costs,
      profit: income - costs,
    };
  });
}
