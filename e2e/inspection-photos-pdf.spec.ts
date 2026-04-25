import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  archiveProperty,
  createProperty,
  createRoom,
  createTenant,
  deleteTenant,
  requireDestructive,
} from "./helpers/crud";
import { E2E_ENTITY_PREFIX } from "./helpers/env";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

// A minimally valid 1×1 JPEG (yellow pixel) — small enough to embed twice
// without bloating the PDF, large enough to be accepted by pdf-lib.
const ONE_PX_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
  0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
  0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
  0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
  0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
  0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
  0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
  0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
  0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
  0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd0, 0xff, 0xd9,
]);

test("inspection photos per item and PDF report download", async ({ page }) => {
  test.setTimeout(300_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let roomUrl: string | null = null;
  let tenantUrl: string | null = null;

  const alertMessages: string[] = [];
  const dialogHandler = async (dialog: import("@playwright/test").Dialog) => {
    alertMessages.push(`[${dialog.type()}] ${dialog.message()}`);
    await dialog.accept().catch(() => undefined);
  };
  page.on("dialog", dialogHandler);

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `${E2E_ENTITY_PREFIX} Inspection PDF ${Date.now()}`,
  });
  propertyUrl = property.url;

  const room = await createRoom(page, property.id, {
    name: `${E2E_ENTITY_PREFIX} PDF Room ${Date.now()}`,
    monthlyRent: "1100",
    depositAmount: "800",
  });
  roomUrl = room.url;

  const tenant = await createTenant(page, {
    firstName: E2E_ENTITY_PREFIX,
    lastName: `PDF ${Date.now()}`,
  });
  tenantUrl = tenant.url;

  try {
    // Assign tenant.
    monitor.reset();
    await page.goto(room.url, { waitUntil: "networkidle" });
    await page.getByTestId("room-add-tenant-button").click();
    await page.getByTestId("assign-tenant-select").selectOption(tenant.id);
    await page.locator('input[name="monthlyRent"]').fill("1100");
    await page.locator('input[name="depositRequired"]').fill("800");
    await page.getByTestId("assign-tenant-submit").click();
    await expect(page.getByTestId("room-current-tenant-card")).toBeVisible({ timeout: 15_000 });
    await assertAppHealthy(page, monitor, "tenant assigned");

    // Go to inventory and add two items.
    monitor.reset();
    await page.locator(`a[href="/rooms/${room.id}/inventory"]`).click();
    await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}/inventory$`), {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "+ Add item", exact: true }).click();
    await page.locator('input[name="name"]').fill("PDF Desk");
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await expect(page.getByText("PDF Desk")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "+ Add item", exact: true }).click();
    await page.locator('input[name="name"]').fill("PDF Chair");
    await page.getByRole("button", { name: "Add item", exact: true }).click();
    await expect(page.getByText("PDF Chair")).toBeVisible({ timeout: 15_000 });

    // Open new-inspection form and attach photos to item rows.
    await page.getByRole("button", { name: "+ New inspection" }).click();
    const form = page.getByTestId("new-inspection-form");
    await expect(form).toBeVisible();

    // Find the two item rows and attach a photo to each via the per-item file input.
    const itemRows = form.getByTestId("new-inspection-item-row");
    await expect(itemRows).toHaveCount(2);

    const firstItemId = (await itemRows.nth(0).getAttribute("data-item-id"))!;
    const secondItemId = (await itemRows.nth(1).getAttribute("data-item-id"))!;
    expect(firstItemId).toBeTruthy();
    expect(secondItemId).toBeTruthy();

    await form
      .getByTestId(`new-inspection-item-photos-${firstItemId}`)
      .setInputFiles({
        name: "desk-1.jpg",
        mimeType: "image/jpeg",
        buffer: ONE_PX_JPEG,
      });
    // A second photo for the same item.
    await form
      .getByTestId(`new-inspection-item-photos-${firstItemId}`)
      .setInputFiles({
        name: "desk-2.jpg",
        mimeType: "image/jpeg",
        buffer: ONE_PX_JPEG,
      });

    // Verify preview thumbnails appear before saving.
    await expect(
      form.locator(`[data-item-id="${firstItemId}"] img`)
    ).toHaveCount(2);

    // Remove one preview, confirm it's gone.
    await form
      .locator(`[data-item-id="${firstItemId}"] button[aria-label="Remove desk-2.jpg"]`)
      .click();
    await expect(
      form.locator(`[data-item-id="${firstItemId}"] img`)
    ).toHaveCount(1);

    // Also attach a general photo.
    await form.getByTestId("new-inspection-general-photos").setInputFiles({
      name: "overall.jpg",
      mimeType: "image/jpeg",
      buffer: ONE_PX_JPEG,
    });

    // Save inspection.
    await page.getByRole("button", { name: "Save inspection" }).click();

    // Saved card is the first card that renders a "Download PDF" link.
    const inspectionCard = page.getByTestId("inspection-card").first();
    await expect(inspectionCard).toBeVisible({ timeout: 30_000 });
    await expect(inspectionCard.getByTestId("inspection-download-pdf")).toBeVisible({
      timeout: 30_000,
    });

    // Fail fast and surface any client-side error alerts (e.g. photo upload failures).
    if (alertMessages.length > 0) {
      throw new Error(`Client raised alerts: ${alertMessages.join(" | ")}`);
    }

    // At least one per-item photo was uploaded for item #1.
    await expect(inspectionCard.getByTestId("inspection-photo-thumb").first()).toBeVisible({
      timeout: 20_000,
    });
    // The save flow triggers a page reload which tears down ObjectURL previews; reset
    // before checking health so transient revoke errors from the prior mount don't leak.
    monitor.reset();
    await page.waitForLoadState("networkidle");
    await assertAppHealthy(page, monitor, "inspection saved with per-item photo");

    // Trigger PDF download and verify bytes look like a PDF.
    const pdfLink = inspectionCard.getByTestId("inspection-download-pdf");
    await expect(pdfLink).toBeVisible();
    const href = await pdfLink.getAttribute("href");
    expect(href).toMatch(/\/api\/inspections\/[^/]+\/report$/);

    const response = await page.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const disposition = response.headers()["content-disposition"] ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toMatch(/inspection-report-/);
    const body = await response.body();
    expect(body.length).toBeGreaterThan(500);
    expect(body.slice(0, 5).toString("ascii")).toBe("%PDF-");
  } finally {
    // Cleanup helpers install their own `page.once("dialog")` handlers; remove ours
    // first so we don't race them into a "Cannot accept dialog which is already handled" error.
    page.off("dialog", dialogHandler);
    // End the active tenancy first so the tenant can be deleted. Keep this
    // best-effort so fixture cleanup still runs when the assertion above fails.
    if (roomUrl) {
      try {
        await page.goto(roomUrl, { waitUntil: "domcontentloaded" });
        const endBtn = page.getByTestId("end-tenancy-btn");
        if (await endBtn.count()) {
          await endBtn.click();
          await page
            .getByTestId("confirm-end-tenancy-btn")
            .click()
            .catch(() => undefined);
          await expect(page.getByTestId("room-vacant-state")).toBeVisible({ timeout: 15_000 });
        }
      } catch {
        // Best-effort — cleanup only.
      }
    }
    if (tenantUrl) {
      await deleteTenant(page, tenantUrl).catch(() => undefined);
    }
    if (propertyUrl) {
      await archiveProperty(page, propertyUrl).catch(() => undefined);
    }
  }
});
