import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  archiveProperty,
  createProperty,
  createRoom,
  createTenant,
  deleteTenant,
  escapeRegExp,
  requireDestructive,
} from "./helpers/crud";
import { E2E_ENTITY_PREFIX } from "./helpers/env";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("contextual navigation connects property, room, tenant, inventory, and form pages", async ({ page }) => {
  test.setTimeout(180_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let roomUrl: string | null = null;
  let tenantUrl: string | null = null;

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `${E2E_ENTITY_PREFIX} Navigation ${Date.now()}`,
  });
  propertyUrl = property.url;

  const room = await createRoom(page, property.id, {
    name: `${E2E_ENTITY_PREFIX} Navigation Room ${Date.now()}`,
  });
  roomUrl = room.url;

  const tenant = await createTenant(page, {
    firstName: E2E_ENTITY_PREFIX,
    lastName: `Navigation ${Date.now()}`,
  });
  tenantUrl = tenant.url;

  try {
    monitor.reset();
    await page.goto(room.url, { waitUntil: "networkidle" });
    await page.getByTestId("room-parent-property-link").click();
    await expect(page).toHaveURL(new RegExp(`/properties/${escapeRegExp(property.id)}$`));
    await assertAppHealthy(page, monitor, "room to parent property link");

    monitor.reset();
    await page.locator(`[data-testid="room-link"][href="/rooms/${room.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${escapeRegExp(room.id)}$`));
    await assertAppHealthy(page, monitor, "property to room link");

    monitor.reset();
    await page.getByTestId("room-add-tenant-button").click();
    await page.getByTestId("assign-tenant-select").selectOption(tenant.id);
    await page.getByTestId("assign-tenant-submit").click();
    await expect(page.getByTestId("room-current-tenant-card")).toBeVisible({ timeout: 15_000 });
    await assertAppHealthy(page, monitor, "assign tenant keeps room context");

    monitor.reset();
    await page.getByTestId("room-tenant-name-link").click();
    await expect(page).toHaveURL(new RegExp(`/tenants/${escapeRegExp(tenant.id)}$`));
    await page.getByTestId("tenant-active-room-link").click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${escapeRegExp(room.id)}$`));
    await assertAppHealthy(page, monitor, "tenant active room link");

    monitor.reset();
    await page.goto(tenant.url, { waitUntil: "networkidle" });
    await page.getByTestId("tenant-active-property-link").click();
    await expect(page).toHaveURL(new RegExp(`/properties/${escapeRegExp(property.id)}$`));
    await assertAppHealthy(page, monitor, "tenant active property link");

    monitor.reset();
    await page.goto(`/rooms/${room.id}/inventory`, { waitUntil: "networkidle" });
    await page.getByTestId("inventory-parent-room-link").click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${escapeRegExp(room.id)}$`));
    await page.goto(`/rooms/${room.id}/inventory`, { waitUntil: "networkidle" });
    await page.getByTestId("inventory-parent-property-link").click();
    await expect(page).toHaveURL(new RegExp(`/properties/${escapeRegExp(property.id)}$`));
    await assertAppHealthy(page, monitor, "inventory parent links");

    monitor.reset();
    await page.goto(`/rooms/${room.id}/edit`, { waitUntil: "networkidle" });
    await page.getByTestId("edit-room-parent-room-link").click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${escapeRegExp(room.id)}$`));
    await page.goto(`/rooms/${room.id}/edit`, { waitUntil: "networkidle" });
    await page.getByTestId("edit-room-parent-property-link").click();
    await expect(page).toHaveURL(new RegExp(`/properties/${escapeRegExp(property.id)}$`));
    await assertAppHealthy(page, monitor, "room edit parent links");

    monitor.reset();
    await page.goto(`/properties/${property.id}/rooms/new`, { waitUntil: "networkidle" });
    await page.getByTestId("new-room-parent-property-link").click();
    await expect(page).toHaveURL(new RegExp(`/properties/${escapeRegExp(property.id)}$`));
    await assertAppHealthy(page, monitor, "new room parent link");

    monitor.reset();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Properties" }).click();
    await expect(page).toHaveURL(/\/properties$/);
    await page.goto(room.url, { waitUntil: "networkidle" });
    await expect(page.getByTestId("room-parent-property-link")).toBeVisible();
    await assertAppHealthy(page, monitor, "mobile sidebar and room context link");

    monitor.reset();
    await page.getByTestId("end-tenancy-btn").click();
    await page.getByTestId("confirm-end-tenancy-btn").click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${escapeRegExp(room.id)}$`));
    await expect(page.getByTestId("room-vacant-state")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("room-parent-property-link")).toBeVisible();
    await assertAppHealthy(page, monitor, "end tenancy returns to room with parent context");
  } finally {
    if (roomUrl) {
      await page.goto(roomUrl, { waitUntil: "domcontentloaded" }).catch(() => undefined);
      const endBtn = page.getByTestId("end-tenancy-btn");
      if ((await endBtn.count().catch(() => 0)) > 0) {
        await endBtn.click().catch(() => undefined);
        await page.getByTestId("confirm-end-tenancy-btn").click().catch(() => undefined);
        await expect(page.getByTestId("room-vacant-state")).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
      }
    }
    if (tenantUrl) {
      await deleteTenant(page, tenantUrl).catch(() => undefined);
    }
    if (propertyUrl) {
      await archiveProperty(page, propertyUrl).catch(() => undefined);
    }
  }
});
