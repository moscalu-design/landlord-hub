import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers/auth";
import { E2E_UPLOAD_TENANT_ID } from "./helpers/env";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

async function resolveTenantPath(page: Page) {
  if (E2E_UPLOAD_TENANT_ID) {
    return `/tenants/${E2E_UPLOAD_TENANT_ID}`;
  }

  await page.goto("/tenants", { waitUntil: "networkidle" });
  const href = await page.locator('a[href^="/tenants/"]').evaluateAll((nodes) =>
    nodes
      .map((node) => (node as HTMLAnchorElement).getAttribute("href"))
      .find((value) => value !== null && value !== "/tenants/new")
  );
  if (!href) {
    throw new Error("No tenant detail links available for file-management E2E test.");
  }

  return href;
}

test("document upload, refresh, and delete stay in sync", async ({ page }) => {
  test.setTimeout(60_000);
  const monitor = attachAppMonitor(page);
  const uniqueName = `e2e-room-fix-${Date.now()}.pdf`;

  await login(page);
  monitor.reset();

  const tenantPath = await resolveTenantPath(page);
  await page.goto(tenantPath, { waitUntil: "networkidle" });
  await assertAppHealthy(page, monitor, `tenant detail ${tenantPath}`);

  const slot = page.getByTestId("document-slot-idDocument");
  const fileInput = page.getByTestId("document-input-idDocument");
  await expect(fileInput).toBeAttached();
  await fileInput.setInputFiles({
    name: uniqueName,
    mimeType: "application/pdf",
    buffer: Buffer.from("e2e document"),
  });

  await expect(slot.getByText(uniqueName)).toBeVisible({ timeout: 15_000 });
  await assertAppHealthy(page, monitor, "after document upload");

  monitor.reset();
  await page.reload({ waitUntil: "networkidle" });
  await expect(slot.getByText(uniqueName)).toBeVisible({ timeout: 15_000 });
  await assertAppHealthy(page, monitor, "after tenant reload");

  monitor.reset();
  await slot.getByTitle("Delete").click();
  await slot.getByRole("button", { name: "Yes" }).click();
  await expect(slot.getByText(uniqueName)).toHaveCount(0, { timeout: 15_000 });
  await assertAppHealthy(page, monitor, "after document delete");
});
