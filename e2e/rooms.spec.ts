import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  archiveProperty,
  createProperty,
  createRoom,
  deleteRoom,
  escapeRegExp,
  requireDestructive,
} from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("room CRUD flow creates, edits, navigates, and deletes safely inside a test property", async ({ page }) => {
  test.setTimeout(90_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let roomUrl: string | null = null;

  await login(page);
  monitor.reset();

  const property = await createProperty(page);
  propertyUrl = property.url;
  await assertAppHealthy(page, monitor, "room fixture property created");

  try {
    monitor.reset();
    await page.goto(`/properties/${property.id}/rooms/new`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Create Room" }).click();
    await expect
      .poll(async () => page.locator('input[name="name"]').evaluate((node) => !(node as HTMLInputElement).checkValidity()))
      .toBe(true);

    const room = await createRoom(page, property.id);
    roomUrl = room.url;
    await assertAppHealthy(page, monitor, "room created");

    monitor.reset();
    await page.goto(propertyUrl, { waitUntil: "networkidle" });
    await expect(page.locator(`[data-testid="room-link"][href="/rooms/${room.id}"]`)).toBeVisible();
    await assertAppHealthy(page, monitor, "property shows created room");

    monitor.reset();
    await page.goto(`${roomUrl}/edit`, { waitUntil: "networkidle" });
    await page.locator('select[name="status"]').selectOption("RESERVED");
    await page.locator('textarea[name="notes"]').fill(`${room.notes}\nEdited by room CRUD test`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Edited by room CRUD test")).toBeVisible();
    await expect(page.getByText("Reserved")).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Edited by room CRUD test")).toBeVisible();
    await assertAppHealthy(page, monitor, "room edit persisted");

    monitor.reset();
    await page.goto(`${roomUrl}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(new URL(roomUrl).pathname)}$`));
    await assertAppHealthy(page, monitor, "room edit cancel");

    monitor.reset();
    await deleteRoom(page, roomUrl);
    await expect(page.locator(`[data-testid="room-link"][href="/rooms/${room.id}"]`)).toHaveCount(0);
    await assertAppHealthy(page, monitor, "room deleted");
    roomUrl = null;
  } finally {
    if (propertyUrl) {
      monitor.reset();
      await archiveProperty(page, propertyUrl);
      await assertAppHealthy(page, monitor, "fixture property archived after room test");
    }
  }
});
