import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers/auth";
import { archiveProperty, createProperty, createRoom, requireDestructive } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

type MortgageInput = {
  label: string;
  type: "amortizing" | "bullet";
  startDate: string;
  termMonths: number;
  initialBalance: number;
  interestRate: number;
  lender?: string;
  notes?: string;
};

function isoMonthDate(offsetMonths: number) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offsetMonths);
  return date.toISOString().slice(0, 10);
}

function calculatePayment(input: MortgageInput) {
  if (input.type === "bullet") {
    return Number((input.initialBalance * (input.interestRate / 100 / 12)).toFixed(2));
  }

  if (input.interestRate === 0) {
    return Number((input.initialBalance / input.termMonths).toFixed(2));
  }

  const monthlyRate = input.interestRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, input.termMonths);
  return Number(
    (
      (input.initialBalance * monthlyRate * factor) /
      (factor - 1)
    ).toFixed(2)
  );
}

async function fillMortgageForm(page: Page, input: MortgageInput) {
  const modal = page.locator('[data-testid="mortgage-add-modal"], [data-testid="mortgage-edit-modal"]').first();
  await expect(modal).toBeVisible();
  await modal.locator('input[name="label"]').fill(input.label);
  await modal.locator('select[name="type"]').selectOption(input.type);
  await modal.locator('input[name="startDate"]').fill(input.startDate);
  await modal.locator('input[name="termMonths"]').fill(String(input.termMonths));
  await modal.locator('input[name="initialBalance"]').fill(String(input.initialBalance));
  await modal.locator('input[name="interestRate"]').fill(String(input.interestRate));
  await modal.locator('input[name="lender"]').fill(input.lender ?? "");
  await modal.locator('textarea[name="notes"]').fill(input.notes ?? "");
  await expect(modal.locator('input[name="monthlyPaymentDisplay"]')).toHaveValue(
    new RegExp(`€${calculatePayment(input).toFixed(0)}|€${calculatePayment(input)}`)
  );
}

test("dedicated mortgage routes support create, details, simulation, prepayments, and cost integration", async ({
  page,
}) => {
  test.setTimeout(180_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;

  const stamp = Date.now();
  const mortgage: MortgageInput = {
    label: `E2E Route Mortgage ${stamp}`,
    type: "amortizing",
    startDate: isoMonthDate(0),
    termMonths: 24,
    initialBalance: 12000,
    interestRate: 12,
    lender: "E2E Route Bank",
    notes: "Dedicated mortgage route coverage",
  };
  const monthlyPayment = calculatePayment(mortgage);

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `E2E Mortgage Routes ${stamp}`,
    notes: "dedicated mortgage route fixture",
  });
  propertyUrl = property.url;

  try {
    await createRoom(page, property.id, {
      name: `E2E Mortgage Room ${stamp}`,
      monthlyRent: "1234",
      depositAmount: "1234",
    });

    monitor.reset();
    await page.goto(`/properties/${property.id}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("property-mortgage-summary")).toBeVisible();
    await page.getByTestId("property-mortgage-summary").getByRole("link", { name: /View all/i }).click();
    await expect(page).toHaveURL(new RegExp(`/properties/${property.id}/mortgages$`));
    await expect(page.getByRole("heading", { name: "Mortgages" })).toBeVisible();
    await assertAppHealthy(page, monitor, "mortgages index before creation");

    monitor.reset();
    await page.getByRole("button", { name: "+ Add Mortgage" }).click();
    await fillMortgageForm(page, mortgage);
    await page.getByTestId("mortgage-add-modal").getByRole("button", { name: "Add Mortgage" }).click();
    await expect(page.locator(`[data-testid^="mortgage-card-"]`).filter({ hasText: mortgage.label })).toContainText(
      `€${monthlyPayment}`
    );
    await expect(page.getByText("Mortgage count").locator("..")).toContainText("1");
    await assertAppHealthy(page, monitor, "mortgages index after creation");

    monitor.reset();
    await page.getByRole("link", { name: "Details" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/properties/${property.id}/mortgages/[^/]+$`));
    await expect(page.getByTestId("mortgage-details-page")).toBeVisible();
    await expect(page.getByTestId("mortgage-details-chart")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Mortgage" })).toBeVisible();
    await assertAppHealthy(page, monitor, "mortgage details page loads");

    monitor.reset();
    await page.getByTestId("open-simulation-button").click();
    await expect(page.getByTestId("mortgage-simulation-panel")).toBeVisible();
    await expect(page.getByTestId("open-simulation-button")).toHaveText("Simulation On");
    await page.getByRole("button", { name: "Remaining balance over time" }).click();
    await expect(page.getByTestId("mortgage-balance-chart")).toBeVisible();
    await expect(page.getByTestId("mortgage-simulation-type").locator("option")).toHaveText([
      "Recurring extra prepayment",
      "One-off lump sum prepayment",
      "Higher total monthly payment",
    ]);
    await page.getByTestId("mortgage-recurring-extra-input").fill("125");
    await page.getByTestId("mortgage-simulation-start-date").fill(isoMonthDate(0));
    await expect(page.getByTestId("mortgage-balance-chart")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("apply-simulation-button").click();
    await expect(page.getByText("Recurring plan")).toBeVisible();
    await assertAppHealthy(page, monitor, "simulation can be applied as actual plan");

    monitor.reset();
    await page.getByTestId("record-prepayment-button").click();
    const prepaymentModal = page.getByTestId("mortgage-prepayment-modal");
    await expect(prepaymentModal).toBeVisible();
    await prepaymentModal.locator("select").selectOption("one_off");
    await prepaymentModal.getByTestId("mortgage-prepayment-amount-input").fill("250");
    await prepaymentModal.getByTestId("mortgage-prepayment-start-date").fill(isoMonthDate(0));
    await prepaymentModal.getByRole("button", { name: "Record Prepayment" }).click();
    await expect(prepaymentModal).toHaveCount(0);
    await expect(
      page.locator('[data-testid^="mortgage-prepayment-row-"]').filter({ hasText: "One-off" }).first()
    ).toBeVisible();
    await assertAppHealthy(page, monitor, "manual prepayment can be recorded");

    monitor.reset();
    await page.getByRole("link", { name: "Back to Mortgages" }).click();
    await expect(page).toHaveURL(new RegExp(`/properties/${property.id}/mortgages$`));
    await expect(page.locator(`[data-testid^="mortgage-card-"]`).filter({ hasText: mortgage.label })).toBeVisible();
    await page.goto(`/properties/${property.id}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("property-summary-profit-value")).toContainText("-");
    await assertAppHealthy(page, monitor, "overview still reflects mortgage cost");
  } finally {
    if (propertyUrl) {
      await archiveProperty(page, propertyUrl);
    }
  }
});
