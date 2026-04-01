import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers/auth";
import { archiveProperty, createProperty, requireDestructive } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

async function openMonth(page: Page, year: number, month: number) {
  const group = page.getByTestId(`expense-month-group-${year}-${String(month).padStart(2, "0")}`);
  await expect(group).toBeVisible();
  if ((await page.locator('[data-testid^="expense-row-"]').count()) === 0) {
    await group.click();
  }
}

function expenseRow(page: Page, title: string) {
  return page.locator('[data-testid^="expense-row-"]').filter({ hasText: title }).first();
}

test("utilities and costs support create, grouping, edit, receipt lifecycle, delete, and invalid receipt notice", async ({
  page,
}) => {
  test.setTimeout(120_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `E2E Utilities Property ${Date.now()}`,
    notes: "utilities e2e fixture",
  });
  propertyUrl = property.url;

  try {
    monitor.reset();
    await page.goto(propertyUrl, { waitUntil: "networkidle" });
    await expect(page.getByTestId("property-expenses-section")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Utilities & Costs" })).toBeVisible();
    await assertAppHealthy(page, monitor, "utilities section renders");

    monitor.reset();
    await page.getByTestId("expense-add-toggle").click();
    await page.getByTestId("expense-add-button").click();
    await expect
      .poll(async () =>
        page.getByTestId("expense-title-input").evaluate((node) => !(node as HTMLInputElement).checkValidity())
      )
      .toBe(true);

    const ts = Date.now();
    const firstTitle = `Electricity for February ${ts}`;
    await page.getByTestId("expense-title-input").fill(firstTitle);
    await page.getByTestId("expense-category-select").selectOption("ELECTRICITY");
    await page.getByTestId("expense-amount-input").fill("87.55");
    await page.getByTestId("expense-recurrence-select").selectOption("MONTHLY");
    await page.getByTestId("expense-payment-date-input").fill("2026-03-10");
    await page.getByTestId("expense-reporting-month-select").selectOption("2");
    await page.getByTestId("expense-reporting-year-select").selectOption("2026");
    await page.getByTestId("expense-provider-input").fill("British Gas");
    await page.getByTestId("expense-notes-input").fill("Bill paid in March for February usage");
    await page.getByTestId("expense-receipt-input").setInputFiles({
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf receipt"),
    });
    await page.getByTestId("expense-add-button").click();
    await expect(page.getByTestId("expense-form")).toHaveCount(0);
    await openMonth(page, 2026, 2);
    const createdRow = expenseRow(page, firstTitle);
    await expect(createdRow).toContainText("€87.55");
    await expect(page.getByTestId("expense-month-group-2026-02")).toContainText("€87.55");
    const receiptLink = createdRow.locator('[data-testid^="expense-receipt-link-"]').first();
    await expect(receiptLink).toBeVisible();
    const receiptHref = await receiptLink.getAttribute("href");
    expect(receiptHref).toBeTruthy();
    const receiptResponse = await page.request.get(receiptHref!);
    expect(receiptResponse.status()).toBe(200);
    expect(receiptResponse.headers()["content-type"]).toContain("application/pdf");
    await assertAppHealthy(page, monitor, "expense created with receipt");

    monitor.reset();
    await page.reload({ waitUntil: "networkidle" });
    await openMonth(page, 2026, 2);
    await expect(expenseRow(page, firstTitle)).toContainText("British Gas");
    await assertAppHealthy(page, monitor, "expense persists after reload");

    monitor.reset();
    await (await expenseRow(page, firstTitle)).locator('[data-testid^="expense-edit-"]').click();
    const updatedTitle = `Insurance payment 2026 ${ts}`;
    await page.getByTestId("expense-title-input").fill(updatedTitle);
    await page.getByTestId("expense-category-select").selectOption("INSURANCE");
    await page.getByTestId("expense-amount-input").fill("120");
    await page.getByTestId("expense-payment-date-input").fill("2026-04-05");
    await page.getByTestId("expense-reporting-month-select").selectOption("4");
    await page.getByTestId("expense-reporting-year-select").selectOption("2026");
    await page.getByTestId("expense-receipt-remove").click();
    await page.getByTestId("expense-save-button").click();
    await expect(page.getByTestId("expense-form")).toHaveCount(0);
    await openMonth(page, 2026, 4);
    const updatedRow = expenseRow(page, updatedTitle);
    await expect(updatedRow).toContainText("€120");
    await expect(updatedRow.locator('[data-testid^="expense-receipt-link-"]')).toHaveCount(0);
    const removedReceiptResponse = await page.request.get(receiptHref!);
    expect(removedReceiptResponse.status()).toBe(404);
    await assertAppHealthy(page, monitor, "expense moved month and receipt removed");

    monitor.reset();
    page.once("dialog", (dialog) => dialog.accept());
    await updatedRow.locator('[data-testid^="expense-delete-"]').click();
    await expect(expenseRow(page, updatedTitle)).toHaveCount(0);
    await page.reload({ waitUntil: "networkidle" });
    await expect(expenseRow(page, updatedTitle)).toHaveCount(0);
    await assertAppHealthy(page, monitor, "expense deleted cleanly");

    monitor.reset();
    await page.getByTestId("expense-add-toggle").click();
    const badTitle = `Bad receipt expense ${ts}`;
    await page.getByTestId("expense-title-input").fill(badTitle);
    await page.getByTestId("expense-category-select").selectOption("OTHER");
    await page.getByTestId("expense-amount-input").fill("25");
    await page.getByTestId("expense-payment-date-input").fill("2026-05-01");
    await page.getByTestId("expense-reporting-month-select").selectOption("5");
    await page.getByTestId("expense-reporting-year-select").selectOption("2026");
    await page.getByTestId("expense-receipt-input").setInputFiles({
      name: "not-a-pdf.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("bad file"),
    });
    await page.getByTestId("expense-add-button").click();
    await expect(page.getByTestId("expense-notice")).toContainText("Only PDF, JPG, and PNG files are allowed.");
    await openMonth(page, 2026, 5);
    const badRow = expenseRow(page, badTitle);
    await expect(badRow).toContainText("€25");
    await expect(badRow.locator('[data-testid^="expense-receipt-link-"]')).toHaveCount(0);
    expect(monitor.pageErrors, "invalid receipt should not trigger page errors").toEqual([]);

    monitor.reset();
    page.once("dialog", (dialog) => dialog.accept());
    await badRow.locator('[data-testid^="expense-delete-"]').click();
    await expect(expenseRow(page, badTitle)).toHaveCount(0);
    await assertAppHealthy(page, monitor, "bad receipt fixture cleaned up");
  } finally {
    if (propertyUrl) {
      monitor.reset();
      await archiveProperty(page, propertyUrl);
      await assertAppHealthy(page, monitor, "utilities fixture property archived");
    }
  }
});
