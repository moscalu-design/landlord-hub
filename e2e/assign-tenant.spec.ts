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

test("assign-tenant flow works on an isolated vacant room and can be undone", async ({ page }) => {
  test.setTimeout(180_000);
  requireDestructive();
  const monitor = attachAppMonitor(page);

  await login(page);
  monitor.reset();

  const property = await createProperty(page);
  const room = await createRoom(page, property.id);
  const tenant = await createTenant(page);

  try {
    await page.goto(room.url, { waitUntil: "networkidle" });
    await assertAppHealthy(page, monitor, `vacant room ${room.url}`);

    const tenantSelect = page.locator('select[name="tenantId"]');

    monitor.reset();
    await page.getByTestId("room-add-tenant-button").click();
    await tenantSelect.selectOption(tenant.id);
    await page.getByRole("button", { name: "Assign Tenant" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Current Tenant" })).toBeVisible();
    await expect(page.getByTestId("room-tenant-name-link")).toContainText(
      `${tenant.firstName} ${tenant.lastName}`
    );
    await assertAppHealthy(page, monitor, `room detail after assign ${room.url}`);

    monitor.reset();
    await page.getByTestId("end-tenancy-btn").click();
    await expect(page.getByTestId("end-tenancy-modal")).toBeVisible();
    await page.getByTestId("confirm-end-tenancy-btn").click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("room-vacant-state")).toContainText("No current tenant assigned");
    await expect(page.getByTestId("room-add-tenant-button")).toBeVisible();
    await assertAppHealthy(page, monitor, `room detail after end tenancy ${room.url}`);
  } finally {
    await deleteTenant(page, tenant.url).catch(() => undefined);
    await archiveProperty(page, property.url).catch(() => undefined);
  }
});
