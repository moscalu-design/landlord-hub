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

test("redesigned property page renders euro financials, profit, chart, and stable section order", async ({
  page,
}) => {
  test.setTimeout(120_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `E2E Property Page ${Date.now()}`,
    notes: "property page redesign fixture",
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
    await expect(page.getByTestId("property-summary-profit")).toContainText("Monthly Profit");
    await expect(page.getByText("Occupied", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Notes" })).toHaveCount(0);
    await expect(page.getByTestId("property-performance-chart-empty")).toBeVisible();
    await expect(page.getByTestId("property-expenses-section")).toBeVisible();
    await expect(page.getByTestId("property-rooms-section")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("£");
    await expect(page.locator(`[data-testid="room-link"][href="/rooms/${room.id}"]`)).toContainText("€1,234");
    await assertAppHealthy(page, monitor, "property page renders before costs");

    const summaryY = await page.getByTestId("property-summary-cards").evaluate((node) => node.getBoundingClientRect().top);
    const chartY = await page
      .locator('[data-testid="property-performance-chart"], [data-testid="property-performance-chart-empty"]')
      .evaluate((node) => node.getBoundingClientRect().top);
    const expensesY = await page.getByTestId("property-expenses-section").evaluate((node) => node.getBoundingClientRect().top);
    const roomsY = await page.getByTestId("property-rooms-section").evaluate((node) => node.getBoundingClientRect().top);
    expect(summaryY).toBeLessThan(chartY);
    expect(chartY).toBeLessThan(expensesY);
    expect(expensesY).toBeLessThan(roomsY);

    monitor.reset();
    await page.getByTestId("expense-add-toggle").click();
    await expect(page.getByTestId("expense-form")).toBeVisible();
    await expect(page.getByText("Amount (€)", { exact: false })).toBeVisible();
    const title = `E2E Insurance ${Date.now()}`;
    await page.getByTestId("expense-title-input").fill(title);
    await page.getByTestId("expense-category-select").selectOption("INSURANCE");
    await page.getByTestId("expense-amount-input").fill("42");
    await page.getByTestId("expense-payment-date-input").fill("2026-04-01");
    await page.getByTestId("expense-reporting-month-select").selectOption("4");
    await page.getByTestId("expense-reporting-year-select").selectOption("2026");
    await page.getByTestId("expense-add-button").click();
    await expect(page.getByTestId("expense-form")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("£");
    await assertAppHealthy(page, monitor, "property page after cost creation");

    await expect
      .poll(async () => parseEuroAmount(await page.getByTestId("property-summary-profit-value").innerText()))
      .toBe(-42);

    const chart = page.getByTestId("property-performance-chart");
    await expect(chart).toBeVisible();
    await expect(page.getByTestId("property-performance-chart-legend")).toContainText("Costs");
    await expect(page.getByTestId("property-performance-chart-legend")).toContainText("Profit");
    await expect(chart.locator("svg")).toBeVisible();
    await expect(page.getByTestId("expense-month-group-2026-04")).toContainText("€42");

    monitor.reset();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("property-summary-profit")).toContainText("-€42");
    await expect(page.locator("body")).not.toContainText("£");
    await expect(page.getByTestId("property-performance-chart")).toBeVisible();
    await assertAppHealthy(page, monitor, "property page persists after reload");

    monitor.reset();
    await page.locator(`[data-testid="room-link"][href="/rooms/${room.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}$`));
    await assertAppHealthy(page, monitor, "room link from property page works");
  } finally {
    if (propertyUrl) {
      await archiveProperty(page, propertyUrl);
    }
  }
});
