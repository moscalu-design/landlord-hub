import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  E2E_ENABLE_PROPERTY_CREATE,
} from "./helpers/env";
import { resolveEditablePropertyPath } from "./helpers/fixtures";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("property edit flow saves and restores the selected property", async ({ page }) => {
  test.setTimeout(90_000);
  const monitor = attachAppMonitor(page);

  await login(page);
  monitor.reset();

  const propertyPath = await resolveEditablePropertyPath(page);
  test.skip(!propertyPath, "No editable property fixture available.");

  await page.goto(`${propertyPath}/edit`, { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, `property edit ${propertyPath}`);

  const nameInput = page.locator('input[name="name"]');
  const notesInput = page.locator('textarea[name="notes"]');
  const originalName = await nameInput.inputValue();
  const originalNotes = await notesInput.inputValue();
  const updatedNotes = `${originalNotes}\n[E2E ${Date.now()}] property edit check`.trim();

  try {
    monitor.reset();
    await notesInput.fill(updatedNotes);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(new RegExp(`${propertyPath!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.locator("h1").first()).toHaveText(originalName);
    await assertAppHealthy(page, monitor, `property detail after edit ${propertyPath}`);

    await page.goto(`${propertyPath}/edit`, { waitUntil: "networkidle" });
    await expect(page.locator('textarea[name="notes"]')).toHaveValue(updatedNotes);
  } finally {
    monitor.reset();
    await page.goto(`${propertyPath}/edit`, { waitUntil: "networkidle" });
    await notesInput.fill(originalNotes);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(new RegExp(`${propertyPath!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.locator("h1").first()).toHaveText(originalName);
    await assertAppHealthy(page, monitor, `property detail restored ${propertyPath}`);
  }
});

test("property create and edit happy path works when mutation testing is enabled", async ({ page }) => {
  test.setTimeout(90_000);
  test.skip(!E2E_ENABLE_PROPERTY_CREATE, "Property create test is disabled unless E2E_ENABLE_PROPERTY_CREATE=true.");

  const monitor = attachAppMonitor(page);
  const unique = Date.now();
  const createdName = `[E2E] Archived Property ${unique}`;
  const editedName = `${createdName} Updated`;
  const createdAddress = `${unique} Test Street`;
  const editedAddress = `${unique} Updated Street`;

  await login(page);
  monitor.reset();

  await page.goto("/properties/new", { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, "new property form");

  await page.locator('input[name="name"]').fill(createdName);
  await page.locator('input[name="address"]').fill(createdAddress);
  await page.locator('input[name="city"]').fill("Test City");
  await page.locator('input[name="postcode"]').fill("E2E 1AA");
  await page.locator('select[name="propertyType"]').selectOption("OTHER");
  await page.locator('select[name="status"]').selectOption("ARCHIVED");
  await page.locator('textarea[name="notes"]').fill("[E2E] created by Playwright");
  await page.getByRole("button", { name: "Create Property" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: createdName })).toBeVisible();
  await assertAppHealthy(page, monitor, "created archived property");

  const propertyUrl = page.url();

  monitor.reset();
  await page.goto(`${propertyUrl}/edit`, { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill(editedName);
  await page.locator('input[name="address"]').fill(editedAddress);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: editedName })).toBeVisible();
  await expect(page.getByText(editedAddress)).toBeVisible();
  await assertAppHealthy(page, monitor, "edited archived property");
});
