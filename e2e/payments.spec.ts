import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  createProperty,
  createRoom,
  createTenant,
  requireDestructive,
} from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

function currentMonthLabel() {
  const today = new Date();
  return today.toLocaleString("en-GB", { month: "long", year: "numeric" });
}

test("payment flow creates relationship-backed payments and records updates safely", async ({ page }) => {
  test.setTimeout(300_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let roomUrl: string | null = null;
  let tenantUrl: string | null = null;
  let tenantName = "";

  await login(page);
  monitor.reset();

  const property = await createProperty(page);
  const room = await createRoom(page, property.id, { monthlyRent: "1111", depositAmount: "1111" });
  roomUrl = room.url;
  const tenant = await createTenant(page);
  tenantUrl = tenant.url;
  tenantName = `${tenant.firstName} ${tenant.lastName}`;

  try {
    monitor.reset();
    await page.goto(roomUrl, { waitUntil: "networkidle" });
    await page.getByTestId("room-add-tenant-button").click();
    await page.getByTestId("assign-tenant-select").selectOption(tenant.id);
    await page.getByTestId("assign-tenant-submit").click();
    await expect(page.getByRole("heading", { name: "Current Tenant" })).toBeVisible();
    await expect(page.getByTestId("room-tenant-name-link")).toHaveText(tenantName);
    await expect(page.getByRole("heading", { name: "Record Payment" })).toBeVisible();
    await expect(page.getByTestId("delete-room-button")).toHaveCount(0);
    await assertAppHealthy(page, monitor, "tenant assigned and payment created");

    monitor.reset();
    await page.goto("/payments", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: new RegExp(tenantName) })).toBeVisible();
    await assertAppHealthy(page, monitor, "payments list shows created occupancy payment");

    monitor.reset();
    await page.goto(roomUrl, { waitUntil: "networkidle" });
    const amountInput = page.locator('input[name="amountPaid"]');
    await amountInput.fill("1111");
    await page.locator('select[name="paymentMethod"]').selectOption("BANK_TRANSFER");
    await page.getByRole("button", { name: "Record Payment" }).click();
    const currentPeriodRow = page.locator("tbody tr").filter({ hasText: currentMonthLabel() });
    await expect(currentPeriodRow.getByTestId("payment-history-paid")).toContainText("€1,111", { timeout: 15_000 });
    await expect(currentPeriodRow).toContainText("Paid", { timeout: 15_000 });
    await assertAppHealthy(page, monitor, "payment recorded");

    monitor.reset();
    await page.goto(tenantUrl, { waitUntil: "networkidle" });
    await expect(page.getByText(property.name)).toBeVisible();
    await expect(page.getByText(room.name)).toBeVisible();
    await assertAppHealthy(page, monitor, "tenant detail relationship integrity");
  } finally {
    // Leave this isolated fixture in local destructive runs; UI cleanup was slower than the behavior under test.
  }
});
