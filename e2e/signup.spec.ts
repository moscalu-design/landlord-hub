import { expect, test } from "@playwright/test";

test("login screen exposes signup option", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
});
