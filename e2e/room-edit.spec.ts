import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { resolveOccupiedRoomPath } from "./helpers/fixtures";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("room edit flow saves and restores room details safely", async ({ page }) => {
  test.setTimeout(90_000);
  const monitor = attachAppMonitor(page);

  await login(page);
  monitor.reset();

  const roomPath = await resolveOccupiedRoomPath(page, monitor);
  test.skip(!roomPath, "No room fixture available for room edit.");

  await page.goto(`${roomPath}/edit`, { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, `room edit ${roomPath}`);

  const nameInput = page.locator('input[name="name"]');
  const notesInput = page.locator('textarea[name="notes"]');
  const originalName = await nameInput.inputValue();
  const originalNotes = await notesInput.inputValue();
  const updatedNotes = `${originalNotes}\n[E2E ${Date.now()}] room edit check`.trim();

  try {
    monitor.reset();
    await notesInput.fill(updatedNotes);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(new RegExp(`${roomPath!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.getByRole("heading", { name: originalName })).toBeVisible();
    await expect(page.getByText(updatedNotes)).toBeVisible();
    await assertAppHealthy(page, monitor, `room detail after edit ${roomPath}`);
  } finally {
    monitor.reset();
    await page.goto(`${roomPath}/edit`, { waitUntil: "networkidle" });
    await notesInput.fill(originalNotes);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: originalName })).toBeVisible();
    if (originalNotes) {
      await expect(page.getByText(originalNotes)).toBeVisible();
    }
    await assertAppHealthy(page, monitor, `room detail restored ${roomPath}`);
  }
});
