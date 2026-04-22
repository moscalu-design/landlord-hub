import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  archiveProperty,
  createProperty,
  createRoom,
  createTenant,
  deleteTenant,
  requireDestructive,
} from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("mobile tenancy lifecycle preserves inventory inspection snapshots", async ({ page }) => {
  test.setTimeout(180_000);
  requireDestructive();
  await page.setViewportSize({ width: 390, height: 844 });

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let tenantUrl: string | null = null;
  let canCleanup = false;

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `[E2E] Inventory Lifecycle ${Date.now()}`,
  });
  propertyUrl = property.url;

  const room = await createRoom(page, property.id, {
    name: `[E2E] Lifecycle Room ${Date.now()}`,
    monthlyRent: "1200",
    depositAmount: "900",
  });

  const tenant = await createTenant(page, {
    firstName: "E2E",
    lastName: `Inventory ${Date.now()}`,
  });
  tenantUrl = tenant.url;

  try {
    monitor.reset();
    await page.goto(room.url, { waitUntil: "networkidle" });
    await page.getByTestId("room-add-tenant-button").click();
    await page.getByTestId("assign-tenant-select").selectOption(tenant.id);
    await page.locator('input[name="monthlyRent"]').fill("1200");
    await page.locator('input[name="depositRequired"]').fill("900");
    await page.getByTestId("assign-tenant-submit").click();
    await expect(page.getByTestId("room-current-tenant-card")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("deposit-required-value")).toContainText("900");
    await assertAppHealthy(page, monitor, "assigned tenant on mobile room");

    monitor.reset();
    await page.getByTestId("deposit-update-button").click();
    await page.getByTestId("deposit-action-type").selectOption("RECEIVED");
    await page.getByTestId("deposit-action-amount").fill("900");
    await page.getByTestId("deposit-action-submit").click();
    await expect(page.getByTestId("deposit-received-value")).toContainText("900");
    await assertAppHealthy(page, monitor, "deposit received");

    monitor.reset();
    await page.locator('input[name="amountPaid"]').fill("500");
    await page.getByTestId("record-payment-submit").click();
    await expect(page.getByTestId("selected-payment-summary")).toContainText("Partial", { timeout: 15_000 });
    await page.locator('input[name="amountPaid"]').fill("1200");
    await page.getByTestId("record-payment-submit").click();
    await expect(page.getByTestId("selected-payment-summary")).toContainText("Paid", { timeout: 15_000 });
    await assertAppHealthy(page, monitor, "partial then full payment");

    monitor.reset();
    await page.locator(`a[href="/rooms/${room.id}/inventory"]`).click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}/inventory$`));
    await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "+ Add item", exact: true }).click();
    await page.locator('input[name="name"]').fill("Lifecycle Desk");
    await page.locator('input[name="estimatedValue"]').fill("150");
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await expect(page.getByText("Lifecycle Desk")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "+ Add item", exact: true }).click();
    await page.locator('input[name="name"]').fill("Lifecycle Lamp");
    await page.locator('input[name="estimatedValue"]').fill("45");
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await expect(page.getByText("Lifecycle Lamp")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "+ New inspection" }).click();
    await page.getByRole("button", { name: "Save inspection" }).click();
    await expect(page.getByText("Check-in")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Lifecycle Desk").first()).toBeVisible();

    await page.getByRole("button", { name: "+ New inspection" }).click();
    const inspectionForm = page.locator("form").filter({ hasText: "Item conditions" });
    await inspectionForm.locator("select").first().selectOption("CHECK_OUT");
    await inspectionForm.locator("select").nth(1).selectOption("DAMAGED");
    await page.getByRole("button", { name: "Save inspection" }).click();
    await expect(page.getByText("Check-out")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Damaged")).toBeVisible();
    await assertAppHealthy(page, monitor, "inventory check-in and check-out");

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByTestId("inventory-item-row")
      .filter({ hasText: "Lifecycle Desk" })
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await expect(page.getByText("Lifecycle Desk").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Check-in")).toBeVisible();
    await expect(page.getByText("Check-out")).toBeVisible();

    monitor.reset();
    await page.goto(room.url, { waitUntil: "networkidle" });
    await page.getByTestId("end-tenancy-btn").click();
    await page.getByTestId("confirm-end-tenancy-btn").click();
    await expect(page.getByTestId("room-vacant-state")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("deposit-refund-warning")).toBeVisible();
    await assertAppHealthy(page, monitor, "ended tenancy with refund warning");
    canCleanup = true;
  } finally {
    if (canCleanup && tenantUrl) {
      await deleteTenant(page, tenantUrl).catch(() => undefined);
    }
    if (canCleanup && propertyUrl) {
      await archiveProperty(page, propertyUrl).catch(() => undefined);
    }
  }
});
