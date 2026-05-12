export type MortgageType = "amortizing" | "bullet";
export type MortgagePrepaymentType = "one_off" | "recurring";
export type MortgagePrepaymentFrequency = "monthly";
export type MortgageScheduleMode = "baseline" | "actual" | "simulation";
export type MortgageSimulationMode =
  | "higher_payment"
  | "lump_sum"
  | "recurring_extra";

export type MortgagePrepaymentRecord = {
  id: string;
  mortgageId?: string;
  type: string;
  amount: number;
  startDate: Date;
  endDate?: Date | null;
  frequency?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type MortgageRecord = {
  id: string;
  startDate: Date;
  termMonths: number;
  initialBalance: number;
  interestRate: number;
  monthlyPayment: number;
  isActive: boolean;
  type?: string | null;
  label?: string | null;
  lender?: string | null;
  notes?: string | null;
  prepayments?: MortgagePrepaymentRecord[];
};

export type MortgageSimulationScenario = {
  mode: MortgageSimulationMode;
  startDate: Date;
  endDate?: Date | null;
  higherMonthlyPayment?: number | null;
  lumpSumAmount?: number | null;
  lumpSumDate?: Date | null;
  extraRecurringAmount?: number | null;
};

export type ScheduleEntry = {
  index: number;
  date: Date;
  year: number;
  month: number;
  balanceBefore: number;
  recurringPayment: number;
  interest: number;
  scheduledPrincipal: number;
  extraPrepayment: number;
  principal: number;
  balloonPayment: number;
  totalPayment: number;
  chartPayment: number;
  chartPrincipal: number;
  balanceAfter: number;
};

export type MonthlyBreakdown = {
  payment: number;
  recurringPayment: number;
  interest: number;
  principal: number;
  scheduledPrincipal: number;
  extraPrepayment: number;
  balloonPayment: number;
  balanceBefore: number;
  balanceAfter: number;
  chartPayment: number;
};

export type MortgageYearData = {
  year: number;
  label: string;
  totalPayments: number;
  totalInterest: number;
  scheduledPrincipal: number;
  extraPrepayments: number;
  totalPrincipal: number;
  chartPrincipal: number;
  chartPayments: number;
  balloonPrincipalExcluded: number;
  endBalance: number;
};

export type MortgageOverview = {
  currentBalance: number;
  payoffDate: Date | null;
  maturityDate: Date | null;
  totalProjectedInterest: number;
  totalProjectedRepayment: number;
  totalProjectedPrincipal: number;
  totalProjectedInterestRemaining: number;
  monthsElapsed: number;
  monthsRemaining: number;
  balloonPaymentAtMaturity: number;
};

export type MortgageSimulation = {
  baselineMonthlyPayment: number;
  simulatedMonthlyPayment: number;
  recurringExtraPayment: number;
  lumpSumPayment: number;
  lumpSumMonthOffset: number;
  baselinePayoffDate: Date | null;
  simulatedPayoffDate: Date | null;
  baselineRemainingInterest: number;
  simulatedRemainingInterest: number;
  interestSavings: number;
  baselineMonthsRemaining: number;
  simulatedMonthsRemaining: number;
  monthsSaved: number;
  totalExtraCashPaid: number;
  scenario: MortgageSimulationScenario;
};

export type MortgageBalancePoint = {
  key: string;
  label: string;
  date: Date;
  balance: number;
};

export type MortgageBalanceComparisonPoint = {
  key: string;
  label: string;
  baselineBalance: number | null;
  actualBalance: number | null;
  simulatedBalance: number | null;
};

type BuildScheduleOptions = {
  prepayments?: MortgagePrepaymentRecord[];
};

type PrepaymentApplication = {
  extraPrepayment: number;
  requestedExtraPrepayment: number;
};

export function normalizeMortgageType(type: string | null | undefined): MortgageType {
  return type === "bullet" ? "bullet" : "amortizing";
}

export function normalizeMortgagePrepaymentType(
  type: string | null | undefined
): MortgagePrepaymentType {
  return type === "recurring" ? "recurring" : "one_off";
}

export function calculateAmortizingMonthlyPayment(
  principal: number,
  annualInterestRate: number,
  termMonths: number
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0) return 0;
  if (!Number.isFinite(termMonths) || termMonths <= 0) return 0;

  if (annualInterestRate === 0) {
    return round2(principal / termMonths);
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return round2((principal * monthlyRate * factor) / (factor - 1));
}

export function calculateBulletMonthlyPayment(
  principal: number,
  annualInterestRate: number
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0) return 0;
  return round2(principal * (annualInterestRate / 100 / 12));
}

export function calculateMortgageMonthlyPayment(input: {
  type: MortgageType;
  principal: number;
  annualInterestRate: number;
  termMonths: number;
}): number {
  return input.type === "bullet"
    ? calculateBulletMonthlyPayment(input.principal, input.annualInterestRate)
    : calculateAmortizingMonthlyPayment(
        input.principal,
        input.annualInterestRate,
        input.termMonths
      );
}

function toMonthDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function scheduleDate(startDate: Date, offsetMonths: number): Date {
  return new Date(startDate.getFullYear(), startDate.getMonth() + offsetMonths, 1);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function labelForDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function elapsedMonths(startDate: Date, year: number, month: number): number {
  return (year - startDate.getFullYear()) * 12 + (month - (startDate.getMonth() + 1));
}

function getMonthlyRate(annualInterestRate: number): number {
  return annualInterestRate / 100 / 12;
}

function getCurrentScheduleIndex(startDate: Date): number {
  const now = new Date();
  return Math.max(0, elapsedMonths(startDate, now.getFullYear(), now.getMonth() + 1));
}

export function buildSchedule(
  mortgage: MortgageRecord,
  options: BuildScheduleOptions = {}
): ScheduleEntry[] {
  const type = normalizeMortgageType(mortgage.type);
  const monthlyRate = getMonthlyRate(mortgage.interestRate);
  const prepayments = (options.prepayments ?? []).filter((prepayment) => prepayment.isActive);
  const entries: ScheduleEntry[] = [];
  let balance = round2(mortgage.initialBalance);

  for (let index = 0; index < mortgage.termMonths && balance > 0; index += 1) {
    const date = scheduleDate(mortgage.startDate, index);
    const balanceBefore = balance;
    const interest = round2(balanceBefore * monthlyRate);
    const isFinalContractMonth = index === mortgage.termMonths - 1;

    let recurringPayment = 0;
    let scheduledPrincipal = 0;
    let balloonPayment = 0;
    let chartPrincipal = 0;

    if (type === "bullet") {
      recurringPayment = calculateBulletMonthlyPayment(balanceBefore, mortgage.interestRate);
      if (isFinalContractMonth) {
        balloonPayment = balanceBefore;
        scheduledPrincipal = balanceBefore;
      }
      recurringPayment = round2(recurringPayment);
    } else {
      recurringPayment = round2(Math.min(mortgage.monthlyPayment, balanceBefore + interest));
      scheduledPrincipal = round2(
        Math.min(balanceBefore, Math.max(recurringPayment - interest, 0))
      );
      chartPrincipal = scheduledPrincipal;
    }

    const balanceAfterScheduled = round2(Math.max(0, balanceBefore - scheduledPrincipal));
    const prepaymentApplication = applyExtraPrepayments(prepayments, date, balanceAfterScheduled);
    balance = round2(
      Math.max(0, balanceAfterScheduled - prepaymentApplication.extraPrepayment)
    );

    const principal = round2(scheduledPrincipal + prepaymentApplication.extraPrepayment);
    const totalPayment = round2(
      recurringPayment +
        prepaymentApplication.extraPrepayment +
        (type === "bullet" ? balloonPayment : 0)
    );
    const chartPayment = round2(
      recurringPayment +
        (type === "bullet" ? prepaymentApplication.extraPrepayment : prepaymentApplication.extraPrepayment)
    );

    entries.push({
      index,
      date,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      balanceBefore: round2(balanceBefore),
      recurringPayment,
      interest,
      scheduledPrincipal: round2(scheduledPrincipal),
      extraPrepayment: round2(prepaymentApplication.extraPrepayment),
      principal,
      balloonPayment: round2(balloonPayment),
      totalPayment,
      chartPayment,
      chartPrincipal: round2(type === "bullet" ? 0 : chartPrincipal),
      balanceAfter: balance,
    });
  }

  return entries;
}

function applyExtraPrepayments(
  prepayments: MortgagePrepaymentRecord[],
  date: Date,
  remainingBalance: number
): PrepaymentApplication {
  const requestedExtraPrepayment = round2(
    prepayments.reduce((sum, prepayment) => {
      if (!appliesToMonth(prepayment, date)) return sum;
      return sum + prepayment.amount;
    }, 0)
  );

  return {
    requestedExtraPrepayment,
    extraPrepayment: round2(Math.min(remainingBalance, requestedExtraPrepayment)),
  };
}

function appliesToMonth(prepayment: MortgagePrepaymentRecord, date: Date): boolean {
  if (!prepayment.isActive) return false;

  const month = toMonthDate(date);
  const startDate = toMonthDate(new Date(prepayment.startDate));
  if (month < startDate) return false;

  const type = normalizeMortgagePrepaymentType(prepayment.type);
  if (type === "one_off") {
    return dateKey(month) === dateKey(startDate);
  }

  const endDate = prepayment.endDate ? toMonthDate(new Date(prepayment.endDate)) : null;
  if (endDate && month > endDate) return false;
  return (prepayment.frequency ?? "monthly") === "monthly";
}

function getCombinedSimulationPrepayments(
  mortgage: MortgageRecord,
  scenario?: MortgageSimulationScenario | null
): MortgagePrepaymentRecord[] {
  const actualPrepayments = (mortgage.prepayments ?? []).filter((prepayment) => prepayment.isActive);
  if (!scenario) return actualPrepayments;
  return [...actualPrepayments, ...buildSimulationPrepayments(mortgage, scenario)];
}

function buildSimulationPrepayments(
  mortgage: MortgageRecord,
  scenario: MortgageSimulationScenario
): MortgagePrepaymentRecord[] {
  const simulationStartDate = toMonthDate(new Date(scenario.startDate));
  const prepayments: MortgagePrepaymentRecord[] = [];

  if (scenario.mode === "higher_payment") {
    const targetPayment = round2(scenario.higherMonthlyPayment ?? mortgage.monthlyPayment);
    const extraRecurringAmount = round2(Math.max(0, targetPayment - mortgage.monthlyPayment));
    if (extraRecurringAmount > 0) {
      prepayments.push({
        id: "simulation-higher-payment",
        type: "recurring",
        amount: extraRecurringAmount,
        startDate: simulationStartDate,
        endDate: scenario.endDate ? toMonthDate(new Date(scenario.endDate)) : null,
        frequency: "monthly",
        isActive: true,
        notes: "Simulation",
      });
    }
  }

  if (scenario.mode === "recurring_extra") {
    const amount = round2(scenario.extraRecurringAmount ?? 0);
    if (amount > 0) {
      prepayments.push({
        id: "simulation-recurring-extra",
        type: "recurring",
        amount,
        startDate: simulationStartDate,
        endDate: scenario.endDate ? toMonthDate(new Date(scenario.endDate)) : null,
        frequency: "monthly",
        isActive: true,
        notes: "Simulation",
      });
    }
  }

  const lumpSumAmount = round2(scenario.lumpSumAmount ?? 0);
  const lumpSumDate = scenario.lumpSumDate
    ? toMonthDate(new Date(scenario.lumpSumDate))
    : simulationStartDate;
  if (lumpSumAmount > 0) {
    prepayments.push({
      id: "simulation-lump-sum",
      type: "one_off",
      amount: lumpSumAmount,
      startDate: lumpSumDate,
      endDate: null,
      frequency: null,
      isActive: true,
      notes: "Simulation",
    });
  }

  return prepayments;
}

function getScheduleForMode(
  mortgage: MortgageRecord,
  mode: MortgageScheduleMode,
  scenario?: MortgageSimulationScenario | null
): ScheduleEntry[] {
  if (mode === "baseline") return buildSchedule(mortgage);
  if (mode === "actual") {
    return buildSchedule(mortgage, { prepayments: mortgage.prepayments ?? [] });
  }
  return buildSchedule(mortgage, {
    prepayments: getCombinedSimulationPrepayments(mortgage, scenario),
  });
}

export function getMortgageSchedule(
  mortgage: MortgageRecord,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): ScheduleEntry[] {
  return getScheduleForMode(mortgage, mode, scenario);
}

export function isMortgageActiveInMonth(
  mortgage: MortgageRecord,
  year: number,
  month: number,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): boolean {
  if (!mortgage.isActive) return false;
  const schedule = getScheduleForMode(mortgage, mode, scenario);
  return schedule.some((entry) => entry.year === year && entry.month === month);
}

export function getBalanceBefore(
  mortgage: MortgageRecord,
  year: number,
  month: number,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): number {
  const targetIndex = elapsedMonths(mortgage.startDate, year, month);
  if (targetIndex <= 0) return round2(mortgage.initialBalance);

  const schedule = getScheduleForMode(mortgage, mode, scenario);
  const previousEntry = schedule[targetIndex - 1];
  if (!previousEntry) return 0;
  return round2(previousEntry.balanceAfter);
}

export function getMonthlyBreakdown(
  mortgage: MortgageRecord,
  year: number,
  month: number,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): MonthlyBreakdown | null {
  const schedule = getScheduleForMode(mortgage, mode, scenario);
  const entry = schedule.find((item) => item.year === year && item.month === month);
  if (!entry) return null;

  return {
    payment: entry.totalPayment,
    recurringPayment: entry.recurringPayment,
    interest: entry.interest,
    principal: entry.principal,
    scheduledPrincipal: entry.scheduledPrincipal,
    extraPrepayment: entry.extraPrepayment,
    balloonPayment: entry.balloonPayment,
    balanceBefore: entry.balanceBefore,
    balanceAfter: entry.balanceAfter,
    chartPayment: entry.chartPayment,
  };
}

export function getCurrentBalance(
  mortgage: MortgageRecord,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): number {
  const now = new Date();
  return getBalanceBefore(mortgage, now.getFullYear(), now.getMonth() + 1, mode, scenario);
}

export function getElapsedTermMonths(mortgage: MortgageRecord): number {
  return Math.max(0, Math.min(getCurrentScheduleIndex(mortgage.startDate), mortgage.termMonths));
}

export function getMortgageMaturityDate(
  mortgage: MortgageRecord,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): Date | null {
  return getScheduleForMode(mortgage, mode, scenario).at(-1)?.date ?? null;
}

export function getMortgageAnnualData(
  mortgage: MortgageRecord,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): MortgageYearData[] {
  const schedule = getScheduleForMode(mortgage, mode, scenario);
  const annualMap = new Map<number, MortgageYearData>();

  for (const entry of schedule) {
    const current = annualMap.get(entry.year) ?? {
      year: entry.year,
      label: String(entry.year),
      totalPayments: 0,
      totalInterest: 0,
      scheduledPrincipal: 0,
      extraPrepayments: 0,
      totalPrincipal: 0,
      chartPrincipal: 0,
      chartPayments: 0,
      balloonPrincipalExcluded: 0,
      endBalance: 0,
    };

    current.totalPayments += entry.totalPayment;
    current.totalInterest += entry.interest;
    current.scheduledPrincipal += entry.scheduledPrincipal;
    current.extraPrepayments += entry.extraPrepayment;
    current.totalPrincipal += entry.principal;
    current.chartPrincipal += entry.chartPrincipal;
    current.chartPayments += entry.chartPayment;
    current.balloonPrincipalExcluded += entry.balloonPayment - entry.chartPrincipal;
    current.endBalance = entry.balanceAfter;
    annualMap.set(entry.year, current);
  }

  return Array.from(annualMap.values())
    .sort((a, b) => a.year - b.year)
    .map((entry) => ({
      ...entry,
      totalPayments: round2(entry.totalPayments),
      totalInterest: round2(entry.totalInterest),
      scheduledPrincipal: round2(entry.scheduledPrincipal),
      extraPrepayments: round2(entry.extraPrepayments),
      totalPrincipal: round2(entry.totalPrincipal),
      chartPrincipal: round2(entry.chartPrincipal),
      chartPayments: round2(entry.chartPayments),
      balloonPrincipalExcluded: round2(entry.balloonPrincipalExcluded),
      endBalance: round2(entry.endBalance),
    }));
}

export function getMortgageOverview(
  mortgage: MortgageRecord,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): MortgageOverview {
  const schedule = getScheduleForMode(mortgage, mode, scenario);
  const currentIndex = Math.min(getCurrentScheduleIndex(mortgage.startDate), schedule.length);
  const maturityDate = schedule.at(-1)?.date ?? null;
  const payoffDate = schedule.find((entry) => entry.balanceAfter <= 0)?.date ?? maturityDate;
  const totalProjectedInterest = round2(schedule.reduce((sum, entry) => sum + entry.interest, 0));
  const totalProjectedRepayment = round2(
    schedule.reduce((sum, entry) => sum + entry.totalPayment, 0)
  );
  const totalProjectedPrincipal = round2(
    schedule.reduce((sum, entry) => sum + entry.principal, 0)
  );
  const totalProjectedInterestRemaining = round2(
    schedule.slice(currentIndex).reduce((sum, entry) => sum + entry.interest, 0)
  );

  return {
    currentBalance: getCurrentBalance(mortgage, mode, scenario),
    payoffDate,
    maturityDate,
    totalProjectedInterest,
    totalProjectedRepayment,
    totalProjectedPrincipal,
    totalProjectedInterestRemaining,
    monthsElapsed: Math.max(0, Math.min(getCurrentScheduleIndex(mortgage.startDate), mortgage.termMonths)),
    monthsRemaining: Math.max(0, schedule.length - currentIndex),
    balloonPaymentAtMaturity: round2(schedule.at(-1)?.balloonPayment ?? 0),
  };
}

export function getMortgageBalanceSeries(
  mortgage: MortgageRecord,
  mode: MortgageScheduleMode = "actual",
  scenario?: MortgageSimulationScenario | null
): MortgageBalancePoint[] {
  return getScheduleForMode(mortgage, mode, scenario).map((entry) => ({
    key: dateKey(entry.date),
    label: labelForDate(entry.date),
    date: entry.date,
    balance: entry.balanceAfter,
  }));
}

export function getMortgageBalanceComparisonData(
  mortgage: MortgageRecord,
  scenario?: MortgageSimulationScenario | null
): MortgageBalanceComparisonPoint[] {
  const baselineSeries = getMortgageBalanceSeries(mortgage, "baseline");
  const actualSeries = getMortgageBalanceSeries(mortgage, "actual");
  const simulatedSeries = scenario
    ? getMortgageBalanceSeries(mortgage, "simulation", scenario)
    : [];

  const points = new Map<string, MortgageBalanceComparisonPoint>();

  for (const point of baselineSeries) {
    points.set(point.key, {
      key: point.key,
      label: point.label,
      baselineBalance: point.balance,
      actualBalance: null,
      simulatedBalance: null,
    });
  }

  for (const point of actualSeries) {
    const existing = points.get(point.key) ?? {
      key: point.key,
      label: point.label,
      baselineBalance: null,
      actualBalance: null,
      simulatedBalance: null,
    };
    existing.actualBalance = point.balance;
    points.set(point.key, existing);
  }

  for (const point of simulatedSeries) {
    const existing = points.get(point.key) ?? {
      key: point.key,
      label: point.label,
      baselineBalance: null,
      actualBalance: null,
      simulatedBalance: null,
    };
    existing.simulatedBalance = point.balance;
    points.set(point.key, existing);
  }

  return Array.from(points.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function getMonthlyCostForMonth(
  mortgage: MortgageRecord,
  year: number,
  month: number
): number {
  return getMonthlyBreakdown(mortgage, year, month, "actual")?.payment ?? 0;
}

export function simulateMortgageScenario(
  mortgage: MortgageRecord,
  scenario: MortgageSimulationScenario
): MortgageSimulation | null {
  const scenarioPrepayments = buildSimulationPrepayments(mortgage, scenario);
  if (scenarioPrepayments.length === 0) return null;

  const baselineSchedule = getScheduleForMode(mortgage, "actual");
  const simulatedSchedule = getScheduleForMode(mortgage, "simulation", scenario);
  const baselineRemainingInterest = remainingInterestFromCurrentMonth(
    baselineSchedule,
    mortgage.startDate
  );
  const simulatedRemainingInterest = remainingInterestFromCurrentMonth(
    simulatedSchedule,
    mortgage.startDate
  );
  const baselineMonthsRemaining = remainingMonthsFromCurrentMonth(
    baselineSchedule,
    mortgage.startDate
  );
  const simulatedMonthsRemaining = remainingMonthsFromCurrentMonth(
    simulatedSchedule,
    mortgage.startDate
  );
  const totalExtraCashPaid = round2(
    simulatedSchedule.reduce(
      (sum, entry, index) => sum + Math.max(0, entry.totalPayment - (baselineSchedule[index]?.totalPayment ?? 0)),
      0
    )
  );

  const recurringExtraPayment =
    scenario.mode === "higher_payment"
      ? round2(
          Math.max(0, (scenario.higherMonthlyPayment ?? mortgage.monthlyPayment) - mortgage.monthlyPayment)
        )
      : round2(scenario.extraRecurringAmount ?? 0);
  const lumpSumPayment = round2(scenario.lumpSumAmount ?? 0);
  const comparisonDate = scenario.lumpSumDate ?? scenario.startDate;
  const lumpSumMonthOffset = lumpSumPayment > 0
    ? Math.max(
        0,
        elapsedMonths(
          scenario.startDate,
          comparisonDate.getFullYear(),
          comparisonDate.getMonth() + 1
        )
      )
    : 0;

  return {
    baselineMonthlyPayment: round2(mortgage.monthlyPayment),
    simulatedMonthlyPayment:
      scenario.mode === "higher_payment"
        ? round2(scenario.higherMonthlyPayment ?? mortgage.monthlyPayment)
        : round2(mortgage.monthlyPayment),
    recurringExtraPayment,
    lumpSumPayment,
    lumpSumMonthOffset,
    baselinePayoffDate: baselineSchedule.at(-1)?.date ?? null,
    simulatedPayoffDate: simulatedSchedule.at(-1)?.date ?? null,
    baselineRemainingInterest,
    simulatedRemainingInterest,
    interestSavings: round2(Math.max(0, baselineRemainingInterest - simulatedRemainingInterest)),
    baselineMonthsRemaining,
    simulatedMonthsRemaining,
    monthsSaved: Math.max(0, baselineMonthsRemaining - simulatedMonthsRemaining),
    totalExtraCashPaid,
    scenario,
  };
}

export function simulateMortgageOverpayment(
  mortgage: MortgageRecord,
  simulatedMonthlyPayment: number,
  options?: {
    lumpSumPayment?: number;
    lumpSumMonthOffset?: number;
  }
): MortgageSimulation | null {
  if (simulatedMonthlyPayment < mortgage.monthlyPayment) return null;

  const startDate = toMonthDate(new Date());
  const lumpSumMonthOffset = Math.max(0, Math.floor(options?.lumpSumMonthOffset ?? 0));

  return simulateMortgageScenario(mortgage, {
    mode: "higher_payment",
    startDate,
    higherMonthlyPayment: simulatedMonthlyPayment,
    lumpSumAmount: round2(options?.lumpSumPayment ?? 0),
    lumpSumDate: scheduleDate(startDate, lumpSumMonthOffset),
  });
}

function remainingInterestFromCurrentMonth(schedule: ScheduleEntry[], startDate: Date): number {
  const currentIndex = Math.min(getCurrentScheduleIndex(startDate), schedule.length);
  return round2(schedule.slice(currentIndex).reduce((sum, entry) => sum + entry.interest, 0));
}

function remainingMonthsFromCurrentMonth(schedule: ScheduleEntry[], startDate: Date): number {
  const currentIndex = Math.min(getCurrentScheduleIndex(startDate), schedule.length);
  return Math.max(0, schedule.length - currentIndex);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
