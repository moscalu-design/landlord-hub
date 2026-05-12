import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test("settings export button triggers ZIP download", async ({ page }) => {
  await page.route("**/api/settings/export", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="rental-app-export_test.zip"',
      },
      body: "fake zip",
    });
  });

  await login(page);
  await page.goto("/settings", { waitUntil: "networkidle" });

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("settings-export-zip").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("rental-app-export_test.zip");
  await expect(page.getByRole("status")).toContainText("Export ZIP is ready.");
});
