import { expect, test } from "@playwright/test";

const PROTECTED_PATHS = ["/dashboard", "/properties", "/tenants", "/payments", "/settings"];

test("protected landlord routes redirect unauthenticated users to login", async ({ page }) => {
  for (const path of PROTECTED_PATHS) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "rentalapp" })).toBeVisible();
  }
});
