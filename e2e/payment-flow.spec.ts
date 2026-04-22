import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { resolveOccupiedRoomPath } from "./helpers/fixtures";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

function formatCurrencyValue(amount: string) {
  const numeric = Number(amount);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

test("record payment flow updates and can be restored on a seeded occupied room", async ({ page }) => {
  test.setTimeout(90_000);
  const monitor = attachAppMonitor(page);

  await login(page);
  monitor.reset();

  const roomPath = await resolveOccupiedRoomPath(page, monitor);
  test.skip(!roomPath, "No occupied room fixture available for payment recording.");

  await page.goto(roomPath!, { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, `occupied room ${roomPath}`);

  const periodSelect = page.locator("select").first();
  const amountInput = page.locator('input[name="amountPaid"]');
  const periodLabel = (await periodSelect.locator("option:checked").textContent())?.trim();
  const originalAmount = (await amountInput.inputValue()) || "0";
  const originalNumeric = Number(originalAmount);
  const updatedAmount = String(originalNumeric >= 1 ? originalNumeric - 1 : originalNumeric + 1);
  const paymentRow = periodLabel
    ? page.getByRole("row", { name: new RegExp(periodLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
    : page.locator("tbody tr").first();
  const paidCell = paymentRow.getByTestId("payment-history-paid");

  try {
    monitor.reset();
    await amountInput.fill(updatedAmount);
    await page.locator('select[name="paymentMethod"]').selectOption("OTHER");
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect(paidCell).toContainText(formatCurrencyValue(updatedAmount), { timeout: 15_000 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator('input[name="amountPaid"]')).toHaveValue(updatedAmount);
    await assertAppHealthy(page, monitor, `payment updated ${roomPath}`);
  } finally {
    monitor.reset();
    await page.locator('input[name="amountPaid"]').fill(originalAmount);
    await page.locator('select[name="paymentMethod"]').selectOption("BANK_TRANSFER");
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect(paidCell).toContainText(formatCurrencyValue(originalAmount), { timeout: 15_000 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator('input[name="amountPaid"]')).toHaveValue(originalAmount);
    await assertAppHealthy(page, monitor, `payment restored ${roomPath}`);
  }
});
