import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { firstNonEmptyOption, resolveVacantRoomPath } from "./helpers/fixtures";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("assign-tenant flow works on a vacant fixture room and can be undone", async ({ page }) => {
  test.setTimeout(90_000);
  const monitor = attachAppMonitor(page);

  await login(page);
  monitor.reset();

  const roomPath = await resolveVacantRoomPath(page, monitor);
  test.skip(!roomPath, "No vacant room with an assignable tenant is available.");

  await page.goto(roomPath!, { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, `vacant room ${roomPath}`);

  const tenantSelect = page.locator('select[name="tenantId"]');
  const option = await firstNonEmptyOption(tenantSelect);

  monitor.reset();
  await tenantSelect.selectOption(option.value);
  await page.getByRole("button", { name: "Assign Tenant" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Current Tenant" })).toBeVisible();
  await expect(page.getByText(option.text.split("·")[0].trim())).toBeVisible();
  await assertAppHealthy(page, monitor, `room detail after assign ${roomPath}`);

  monitor.reset();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "End Tenancy" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Assign Tenant" })).toBeVisible();
  await assertAppHealthy(page, monitor, `room detail after end tenancy ${roomPath}`);
});
