import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import { archiveProperty, createProperty, escapeRegExp, requireDestructive } from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

test("property CRUD flow creates, edits, validates, manages utility costs, and archives safely", async ({ page }) => {
  test.setTimeout(120_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let propertyName = "";

  await login(page);
  monitor.reset();

  await page.goto("/properties/new", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create Property" }).click();
  await expect
    .poll(async () => page.locator('input[name="name"]').evaluate((node) => !(node as HTMLInputElement).checkValidity()))
    .toBe(true);

  const created = await createProperty(page);
  propertyUrl = created.url;
  propertyName = created.name;
  await assertAppHealthy(page, monitor, "property created");

  try {
    monitor.reset();
    await page.goto("/properties", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(propertyName)) })).toBeVisible();
    await assertAppHealthy(page, monitor, "properties list after create");

    monitor.reset();
    await page.goto(`${propertyUrl}/edit`, { waitUntil: "networkidle" });
    await page.locator('textarea[name="notes"]').fill(`${created.notes}\nEdited by property CRUD test`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(new URL(propertyUrl).pathname)}$`));
    await page.goto(`${propertyUrl}/edit`, { waitUntil: "networkidle" });
    await expect(page.locator('textarea[name="notes"]')).toHaveValue(`${created.notes}\nEdited by property CRUD test`);
    await assertAppHealthy(page, monitor, "property edit persisted");

    monitor.reset();
    await page.goto(propertyUrl, { waitUntil: "networkidle" });
    await page.getByTestId("quick-add-cost-button").click();
    await page.getByTestId("quick-add-cost-modal").locator('select[name="category"]').selectOption("INTERNET");
    await page.getByTestId("quick-add-cost-modal").locator('input[name="amount"]').fill("45");
    await page.getByTestId("quick-add-cost-modal").getByRole("button", { name: "Add cost" }).click();
    await page.locator(`a[href="${new URL(propertyUrl).pathname}/costs"]`).first().click();
    await expect(page.getByTestId("property-expenses-section")).toContainText("€45");
    await assertAppHealthy(page, monitor, "utility cost added");

    monitor.reset();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator('[data-testid^="expense-delete-"]').first().click();
    await expect(page.getByTestId("property-expenses-section")).not.toContainText("€45");
    await assertAppHealthy(page, monitor, "utility cost deleted");

    monitor.reset();
    await page.goto(`${propertyUrl}/edit`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(new URL(propertyUrl).pathname)}$`));
    await assertAppHealthy(page, monitor, "property edit cancel");
  } finally {
    if (propertyUrl) {
      monitor.reset();
      await archiveProperty(page, propertyUrl);
      await expect(page.getByRole("link", { name: new RegExp(escapeRegExp(propertyName)) })).toHaveCount(0);
      await assertAppHealthy(page, monitor, "property archived");
    }
  }
});
