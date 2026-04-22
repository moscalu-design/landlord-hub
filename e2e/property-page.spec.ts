import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { archiveProperty, createProperty, createRoom, requireDestructive } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

function parseEuroAmount(value: string) {
  const match = value.match(/-?€[\d,]+(?:\.\d+)?/);
  if (!match) {
    throw new Error(`Could not find euro amount in: ${value}`);
  }

  return Number(match[0].replace("€", "").replaceAll(",", ""));
}

test("overview and costs routes support quick add and stay in sync", async ({ page }) => {
  test.setTimeout(120_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `E2E Property Page ${Date.now()}`,
    notes: "property overview and costs fixture",
  });
  propertyUrl = property.url;

  try {
    const room = await createRoom(page, property.id, {
      name: `E2E Room ${Date.now()}`,
      monthlyRent: "1234",
      depositAmount: "1234",
    });

    monitor.reset();
    await page.goto(propertyUrl, { waitUntil: "networkidle" });

    await expect(page.getByTestId("property-summary-cards")).toBeVisible();
    await expect(page.getByTestId("property-summary-income")).toContainText("€0");
    await expect(page.getByTestId("property-summary-profit")).toContainText("€0");
    await expect(page.getByTestId("property-performance-chart-empty")).toBeVisible();
    await expect(page.getByTestId("property-mortgage-summary")).toBeVisible();
    await expect(page.getByTestId("property-costs-summary")).toBeVisible();
    await expect(page.getByTestId("quick-add-cost-button")).toBeVisible();
    await expect(page.getByTestId("property-rooms-section")).toBeVisible();
    await expect(page.locator(`[data-testid="room-link"][href="/rooms/${room.id}"]`)).toContainText("€1,234");
    await assertAppHealthy(page, monitor, "overview renders before costs");

    const summaryY = await page.getByTestId("property-summary-cards").evaluate((node) => node.getBoundingClientRect().top);
    const chartY = await page
      .locator('[data-testid="property-performance-chart"], [data-testid="property-performance-chart-empty"]')
      .evaluate((node) => node.getBoundingClientRect().top);
    const mortgageY = await page.getByTestId("property-mortgage-summary").evaluate((node) => node.getBoundingClientRect().top);
    const costsY = await page.getByTestId("property-costs-summary").evaluate((node) => node.getBoundingClientRect().top);
    const roomsY = await page.getByTestId("property-rooms-section").evaluate((node) => node.getBoundingClientRect().top);
    expect(summaryY).toBeLessThan(chartY);
    expect(chartY).toBeLessThan(mortgageY);
    expect(mortgageY).toBeLessThan(costsY);
    expect(costsY).toBeLessThan(roomsY);

    monitor.reset();
    await page.locator(`a[href="/properties/${property.id}/costs"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/properties/${property.id}/costs$`));
    await expect(page.getByTestId("costs-empty-helper")).toBeVisible();
    await expect(page.getByTestId("quick-add-cost-button")).toBeVisible();
    await assertAppHealthy(page, monitor, "costs page empty state renders");

    monitor.reset();
    await page.locator(`a[href="/properties/${property.id}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/properties/${property.id}$`));
    await page.getByTestId("quick-add-cost-button").click();
    await expect(page.getByTestId("quick-add-cost-modal")).toBeVisible();
    await page.locator('[data-testid="quick-add-cost-modal"] input[name="amount"]').fill("42");
    await page.locator('[data-testid="quick-add-cost-modal"] input[name="paymentDate"]').fill("2026-04-01");
    await page.locator('[data-testid="quick-add-cost-modal"] button[type="submit"]').click();
    await expect(page.getByTestId("property-summary-profit-value")).toContainText("-");
    await assertAppHealthy(page, monitor, "overview quick add works");

    await expect
      .poll(async () => parseEuroAmount(await page.getByTestId("property-summary-profit-value").innerText()))
      .toBe(-42);

    monitor.reset();
    await page.locator(`a[href="/properties/${property.id}/costs"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/properties/${property.id}/costs$`));
    await expect(page.getByTestId("quick-add-cost-button")).toBeVisible();
    await expect(page.getByTestId("property-expenses-section")).toContainText("€42");
    await assertAppHealthy(page, monitor, "costs page shows overview quick add entry result");

    monitor.reset();
    await page.getByTestId("quick-add-cost-button").click();
    const quickAdd = page.getByTestId("quick-add-cost-modal");
    await expect(quickAdd).toBeVisible();
    await quickAdd.getByRole("button", { name: "Monthly recurring" }).click();
    await quickAdd.locator('input[name="amount"]').fill("75");
    await quickAdd.locator('input[name="startDate"]').fill("2026-04-01");
    await quickAdd.locator('button[type="submit"]').click();
    await expect(page.getByTestId("property-expenses-section")).toContainText("€75");
    await assertAppHealthy(page, monitor, "costs page quick add supports recurring costs");

    monitor.reset();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("property-expenses-section")).toContainText("€42");
    await expect(page.getByTestId("property-expenses-section")).toContainText("€75");
    await assertAppHealthy(page, monitor, "cost entries persist after reload");
  } finally {
    if (propertyUrl) {
      await archiveProperty(page, propertyUrl);
    }
  }
});
