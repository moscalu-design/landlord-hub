import { expect, test, type Page } from "@playwright/test";
import { E2E_TEST_EMAIL, E2E_TEST_PASSWORD } from "./helpers/env";

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(E2E_TEST_EMAIL);
  await page.locator('input[name="password"]').fill(E2E_TEST_PASSWORD);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 20_000 }),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}

test("Berchem House shows generated May rent charges as overdue with Payments before Costs", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await page.goto("/properties", { waitUntil: "networkidle" });
  const berchemLink = page.getByTestId("property-link").filter({ hasText: /Berchem House/i }).first();
  await expect(berchemLink).toBeVisible();
  await berchemLink.click();
  await expect(page.locator("h1")).toContainText("Berchem House");

  const subnavText = await page.getByRole("navigation", { name: "Property sections" }).innerText();
  expect(subnavText.indexOf("Payments")).toBeGreaterThanOrEqual(0);
  expect(subnavText.indexOf("Costs")).toBeGreaterThan(subnavText.indexOf("Payments"));

  await page
    .getByRole("navigation", { name: "Property sections" })
    .getByRole("link", { name: "Payments" })
    .click();
  await expect(page).toHaveURL(/\/properties\/[^/]+\/payments$/);
  await expect(page.getByRole("heading", { name: /Berchem House Payments/ })).toBeVisible();

  const mayRows = page.getByTestId("property-payment-row").filter({ hasText: "May 2026" });
  await expect(mayRows).toHaveCount(3);
  await expect(mayRows.filter({ hasText: "Sebastian Quine" })).toHaveCount(1);
  await expect(mayRows.filter({ hasText: "Alberto Pellegrino" })).toHaveCount(1);
  await expect(mayRows.filter({ hasText: "Natasha Camero" })).toHaveCount(1);
  await expect(mayRows.filter({ hasText: "05 May 2026" })).toHaveCount(3);
  await expect(mayRows.filter({ hasText: "Overdue" })).toHaveCount(3);
  await expect(page.getByTestId("property-payment-record").first()).toBeVisible();
});
