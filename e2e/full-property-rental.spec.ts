import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  archiveProperty,
  createTenant,
  deleteTenant,
  pathId,
  requireDestructive,
} from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

function currentMonthLabel() {
  return new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
}

async function createFullProperty(page: Page) {
  const timestamp = Date.now();
  const name = `CODEx Full Property Rental Test ${timestamp}`;

  await page.goto("/properties/new", { waitUntil: "networkidle" });
  await page.getByText("Whole property").click();
  await page.getByTestId("property-monthly-rent-input").fill("1666");
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="address"]').fill("test address");
  await page.locator('input[name="city"]').fill("Test City");
  await page.locator('input[name="postcode"]').fill("TEST 1");
  await page.locator('select[name="propertyType"]').selectOption("HOUSE");
  await page.getByTestId("property-total-room-count-input").fill("5");
  await page.getByTestId("property-bedroom-count-input").fill("3");
  await page.getByTestId("property-bathroom-count-input").fill("2");
  await page.getByTestId("property-hasTerrace-input").check();
  await page.getByTestId("property-hasGarden-input").check();
  await page.getByTestId("property-hasParking-input").check();
  await page.locator('textarea[name="description"]').fill("Full-property rental e2e fixture");
  await page.getByRole("button", { name: "Create Property" }).click();

  await expect(page).toHaveURL(/\/properties\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name })).toBeVisible();

  return {
    id: pathId(new URL(page.url()).pathname),
    url: page.url(),
    name,
  };
}

test("full-property rental uses whole-property tenancy and unified payments", async ({ page }) => {
  test.setTimeout(240_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let tenantUrl: string | null = null;

  await login(page);
  monitor.reset();

  const tenant = await createTenant(page, {
    firstName: "CODEx",
    lastName: `Full Property ${Date.now()}`,
  });
  tenantUrl = tenant.url;

  const property = await createFullProperty(page);
  propertyUrl = property.url;

  try {
    await expect(page.getByTestId("property-summary-mode")).toContainText("Whole property");
    await expect(page.getByTestId("property-static-info")).toContainText("Total Rooms");
    await expect(page.getByTestId("property-static-info")).toContainText("5");
    await expect(page.getByTestId("property-rooms-section")).toHaveCount(0);
    await expect(page.locator('a[href$="/rooms/new"]')).toHaveCount(0);
    await assertAppHealthy(page, monitor, "full-property created");

    const paymentsLink = page.locator(`a[href="/properties/${property.id}/payments"]`).first();
    const costsLink = page.locator(`a[href="/properties/${property.id}/costs"]`).first();
    const paymentsX = await paymentsLink.evaluate((node) => node.getBoundingClientRect().left);
    const costsX = await costsLink.evaluate((node) => node.getBoundingClientRect().left);
    expect(paymentsX).toBeLessThan(costsX);

    await page.getByTestId("whole-property-add-tenant-button").click();
    await expect(page.getByTestId("whole-property-add-tenant-modal")).toBeVisible();
    await page.getByTestId("whole-property-tenant-select").selectOption(tenant.id);
    await expect(page.getByTestId("whole-property-monthly-rent")).toHaveValue("1666");
    await page.getByTestId("whole-property-assign-submit").click();
    await expect(page.getByTestId("whole-property-tenant-card")).toContainText(
      `${tenant.firstName} ${tenant.lastName}`,
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("whole-property-tenant-card")).toContainText("€1,666");
    await assertAppHealthy(page, monitor, "whole-property tenancy assigned");

    await page.goto(`/properties/${property.id}/payments`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("property-payments-table")).toBeVisible();
    const currentRow = page.getByTestId("property-payment-row").filter({
      hasText: currentMonthLabel(),
    });
    await expect(currentRow).toContainText("Whole property");
    await expect(currentRow).toContainText("€1,666");
    await expect(currentRow).toContainText(/Overdue|Unpaid/);

    await currentRow.getByTestId("property-payment-record").click();
    await currentRow.getByTestId("property-payment-amount").fill("1666");
    await currentRow.getByTestId("property-payment-save").click();
    await expect(currentRow).toContainText("Paid", { timeout: 15_000 });
    await assertAppHealthy(page, monitor, "whole-property payment recorded");

    await page.goto("/payments", { waitUntil: "networkidle" });
    await expect
      .poll(async () => page.getByText(property.name).count())
      .toBeGreaterThan(0);
    await expect
      .poll(async () => page.getByText("Whole property").count())
      .toBeGreaterThan(0);
    await assertAppHealthy(page, monitor, "global payments show whole-property payment");

    await page.goto(property.url, { waitUntil: "networkidle" });
    await expect(page.getByTestId("whole-property-payment-card")).toContainText("Paid");
  } finally {
    if (propertyUrl) {
      await page.goto(propertyUrl, { waitUntil: "networkidle" }).catch(() => undefined);
      const endButton = page.getByTestId("end-tenancy-btn");
      if ((await endButton.count().catch(() => 0)) > 0) {
        await endButton.click().catch(() => undefined);
        await page.getByTestId("confirm-end-tenancy-btn").click().catch(() => undefined);
        await expect(page.getByTestId("whole-property-vacant-state"))
          .toBeVisible({ timeout: 15_000 })
          .catch(() => undefined);
      }
      await archiveProperty(page, propertyUrl).catch(() => undefined);
    }
    if (tenantUrl) {
      await deleteTenant(page, tenantUrl).catch(() => undefined);
    }
  }
});

test("room-level property still supports manual room management", async ({ page }) => {
  test.setTimeout(120_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  const name = `CODEx Room Level Regression ${Date.now()}`;
  let propertyUrl: string | null = null;

  await login(page);
  monitor.reset();

  await page.goto("/properties/new", { waitUntil: "networkidle" });
  await page.getByText("Room by room").click();
  await expect(page.getByTestId("property-monthly-rent-input")).toHaveCount(0);
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="address"]').fill("room level test address");
  await page.locator('input[name="city"]').fill("Test City");
  await page.getByRole("button", { name: "Create Property" }).click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  propertyUrl = page.url();
  const propertyId = pathId(new URL(propertyUrl).pathname);

  try {
    await expect(page.getByTestId("property-rooms-section")).toBeVisible();
    await expect(page.locator(`a[href="/properties/${propertyId}/payments"]`).first()).toBeVisible();
    await page.goto(`/properties/${propertyId}/rooms/new`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Add Room" })).toBeVisible();
    await assertAppHealthy(page, monitor, "room-level rental remains room-managed");
  } finally {
    if (propertyUrl) {
      await archiveProperty(page, propertyUrl).catch(() => undefined);
    }
  }
});
