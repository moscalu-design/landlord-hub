import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { escapeRegExp } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("room links expose a contextual return path to the parent property", async ({ page }) => {
  test.setTimeout(90_000);
  const monitor = attachAppMonitor(page);

  await login(page);
  monitor.reset();

  await page.goto("/properties", { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, "properties index");

  const propertyHrefs = await page.locator('[data-testid="property-link"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")).filter(Boolean)
  );

  expect(propertyHrefs.length).toBeGreaterThan(0);
  let testedPropertyHref: string | null = null;
  let testedRoomHref: string | null = null;

  for (const propertyHref of propertyHrefs) {
    if (!propertyHref) continue;

    monitor.reset();
    await page.goto(propertyHref, { waitUntil: "networkidle" });
    await assertAppHealthy(page, monitor, `property detail ${propertyHref}`);

    const roomHrefs = await page.locator('[data-testid="room-link"]').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")).filter(Boolean)
    );

    if (roomHrefs.length === 0) continue;

    testedPropertyHref = propertyHref;
    testedRoomHref = roomHrefs[0] ?? null;
    break;
  }

  expect(testedPropertyHref, "expected at least one property with a room").toBeTruthy();
  expect(testedRoomHref, "expected at least one room link across visible properties").toBeTruthy();

  monitor.reset();
  await page.goto(testedPropertyHref!, { waitUntil: "networkidle" });
  await page.locator(`[data-testid="room-link"][href="${testedRoomHref}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(testedRoomHref!)}$`));
  await expect(page.getByTestId("room-parent-property-link")).toBeVisible();
  await assertAppHealthy(page, monitor, `room detail ${testedRoomHref}`);

  monitor.reset();
  await page.getByTestId("room-parent-property-link").click();
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(testedPropertyHref!)}$`));
  await assertAppHealthy(page, monitor, `room parent property ${testedPropertyHref}`);
});
