import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { resolveOccupiedRoomPath } from "./helpers/fixtures";
import { attachAppMonitor, assertAppHealthy } from "./helpers/monitor";

test("active tenancy lease start can be corrected", async ({ page }) => {
  test.setTimeout(90_000);
  const monitor = attachAppMonitor(page);

  await login(page);
  monitor.reset();

  const roomPath = await resolveOccupiedRoomPath(page, monitor);
  test.skip(!roomPath, "No occupied room fixture is available.");

  await page.goto(roomPath!, { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, `occupied room ${roomPath}`);

  const initialLeaseStart = (await page.locator('[data-testid="edit-occupancy-link"]').count()) > 0;
  test.skip(!initialLeaseStart, "No editable active tenancy is available.");

  await page.getByTestId("edit-occupancy-link").click();
  await page.waitForURL(/\/occupancies\/[^/]+\/edit$/);
  await expect(page.getByTestId("edit-occupancy-lease-start")).toBeVisible();

  const leaseStartInput = page.getByTestId("edit-occupancy-lease-start");
  const currentValue = await leaseStartInput.inputValue();
  const updatedValue = currentValue === "2024-01-01" ? "2024-02-01" : "2024-01-01";

  await leaseStartInput.fill(updatedValue);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForLoadState("networkidle");

  const expectedText = updatedValue === "2024-01-01" ? "01 Jan 2024" : "01 Feb 2024";
  await expect(page.getByText(expectedText)).toBeVisible();
  await assertAppHealthy(page, monitor, `room detail after editing tenancy ${roomPath}`);
});
