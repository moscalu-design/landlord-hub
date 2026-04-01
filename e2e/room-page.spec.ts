import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";
import {
  archiveProperty,
  createProperty,
  createRoom,
  createTenant,
  requireDestructive,
} from "./helpers/crud";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

test("room tenancy, deposit, tenant navigation, and contract workflow stay consistent", async ({
  page,
}) => {
  test.setTimeout(240_000);
  requireDestructive();

  const monitor = attachAppMonitor(page);
  let propertyUrl: string | null = null;
  let roomUrl: string | null = null;
  let tenantName = "";

  await login(page);
  monitor.reset();

  const property = await createProperty(page, {
    name: `E2E Tenancy Property ${Date.now()}`,
    notes: "room tenancy fixture",
  });
  propertyUrl = property.url;
  const room = await createRoom(page, property.id, {
    name: `E2E Tenancy Room ${Date.now()}`,
    monthlyRent: "1234",
    depositAmount: "1234",
  });
  roomUrl = room.url;
  const tenant = await createTenant(page);
  tenantName = `${tenant.firstName} ${tenant.lastName}`;

  try {
    monitor.reset();
    await page.goto(roomUrl, { waitUntil: "networkidle" });
    await expect(page.getByTestId("room-default-deposit-value")).toContainText("€1,234");
    await expect(page.getByRole("heading", { name: "Assign Tenant" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("£");
    await assertAppHealthy(page, monitor, "vacant room renders");

    monitor.reset();
    await page.locator('select[name="tenantId"]').selectOption(tenant.id);
    await page.locator('input[name="leaseStart"]').fill("2025-08-01");
    await page.locator('input[name="leaseEnd"]').fill("2026-12-31");
    await page.locator('input[name="moveInDate"]').fill("2025-08-01");
    await page.getByRole("button", { name: "Assign Tenant" }).click();
    await expect(page.getByTestId("room-current-tenant-card")).toBeVisible();
    await expect(page.getByTestId("room-tenant-name-link")).toContainText(tenantName);
    await expect(page.getByText("31 Dec 2026")).toBeVisible();
    await expect(page.getByTestId("deposit-required-value")).toContainText("€1,234");
    await expect(page.getByTestId("deposit-received-value")).toContainText("€0");
    await expect(page.getByTestId("deposit-outstanding-value")).toContainText("€1,234");
    await expect(page.getByTestId("room-deposit-card")).toContainText("Pending");
    await expect(page.getByTestId("deposit-update-button")).toBeVisible();
    await expect(page.getByTestId("payment-history-payer").first()).toContainText(tenantName);
    await expect(page.locator("tbody tr")).toHaveCount(5);
    await assertAppHealthy(page, monitor, "tenant assigned with pending deposit");

    monitor.reset();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("room-current-tenant-card")).toContainText(tenantName);
    await expect(page.getByText("31 Dec 2026")).toBeVisible();
    await expect(page.getByTestId("deposit-required-value")).toContainText("€1,234");
    await assertAppHealthy(page, monitor, "active tenancy persists after reload");

    monitor.reset();
    await page.getByTestId("room-tenant-name-link").click();
    await expect(page).toHaveURL(new RegExp(`/tenants/${tenant.id}$`));
    await expect(page.locator("h1")).toContainText(tenantName);
    await page.goBack({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}$`));
    await page.getByTestId("room-tenant-avatar-link").click();
    await expect(page).toHaveURL(new RegExp(`/tenants/${tenant.id}$`));
    await page.goBack({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}$`));
    await assertAppHealthy(page, monitor, "tenant name and avatar navigation work");

    monitor.reset();
    await page.getByTestId("contract-input").setInputFiles({
      name: "not-a-contract.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("bad contract"),
    });
    await expect(page.getByText("Only PDF files are allowed.")).toBeVisible();
    expect(monitor.pageErrors, "invalid contract upload should not crash page").toEqual([]);

    monitor.reset();
    const firstUploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/occupancies/") &&
        response.url().includes("/contract") &&
        response.request().method() === "POST"
    );
    await page.getByTestId("contract-input").setInputFiles({
      name: "contract-v1.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("contract version 1"),
    });
    const firstUploadResponse = await firstUploadResponsePromise;
    expect(firstUploadResponse.status()).toBe(200);
    await expect
      .poll(
        async () => ({
          linkCount: await page.getByTestId("contract-link").count(),
          errors: await page.locator("text=/Unauthorized|Only PDF files are allowed.|File storage unavailable|Contracts can only be attached/i").allInnerTexts(),
        }),
        { timeout: 15_000 }
      )
      .toEqual({ linkCount: 1, errors: [] });
    await expect(page.getByTestId("contract-link")).toContainText("contract-v1.pdf");
    const firstContract = await page.getByTestId("contract-link").getAttribute("href");
    expect(firstContract).toBeTruthy();
    const firstContractResponse = await page.request.get(firstContract!);
    expect(firstContractResponse.status()).toBe(200);
    expect(firstContractResponse.headers()["content-type"]).toContain("application/pdf");
    await assertAppHealthy(page, monitor, "contract uploaded");

    monitor.reset();
    const replaceResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/occupancies/") &&
        response.url().includes("/contract") &&
        response.request().method() === "POST"
    );
    await page.getByTestId("contract-input").setInputFiles({
      name: "contract-v2.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("contract version 2"),
    });
    const replaceResponse = await replaceResponsePromise;
    expect(replaceResponse.status()).toBe(200);
    await expect
      .poll(async () => page.getByTestId("contract-link").count(), { timeout: 15_000 })
      .toBe(1);
    await expect(page.getByTestId("contract-link")).toContainText("contract-v2.pdf");
    const removeResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/occupancies/") &&
        response.url().includes("/contract") &&
        response.request().method() === "DELETE"
    );
    await page.getByTestId("contract-remove-button").click();
    const removeResponse = await removeResponsePromise;
    expect(removeResponse.status()).toBe(200);
    await expect
      .poll(async () => page.getByTestId("contract-link").count(), { timeout: 15_000 })
      .toBe(0);
    await expect(page.getByTestId("contract-upload-button")).toBeVisible();
    await assertAppHealthy(page, monitor, "contract replaced and removed");

    monitor.reset();
    await page.getByTestId("deposit-update-button").click();
    await expect(page.getByTestId("deposit-update-modal")).toBeVisible();
    await page.getByTestId("deposit-action-type").selectOption("RECEIVED");
    await page.getByTestId("deposit-action-amount").fill("1234");
    await page.getByTestId("deposit-action-description").fill("Initial deposit received");
    await page.getByTestId("deposit-action-submit").click();
    await expect
      .poll(async () => page.getByTestId("deposit-received-value").innerText())
      .toContain("€1,234");
    await expect(page.getByTestId("deposit-outstanding-value")).toContainText("€0");
    await expect(page.getByTestId("room-deposit-card")).toContainText("Received");
    await assertAppHealthy(page, monitor, "deposit received recorded");

    monitor.reset();
    await expect(page.getByRole("button", { name: "Record Payment Now" })).toBeVisible();
    const currentPeriodRow = page.locator("tbody tr").first();
    await expect(currentPeriodRow).toContainText(tenantName);
    await page.locator('input[name="amountPaid"]').fill("1234");
    await page.locator('select[name="paymentMethod"]').selectOption("BANK_TRANSFER");
    await page.getByRole("button", { name: "Record Payment Now" }).click();
    await expect(currentPeriodRow).toContainText("€1,234");
    await expect(currentPeriodRow).toContainText("Paid");
    await assertAppHealthy(page, monitor, "payment recorded from room screen");

    monitor.reset();
    await page.getByTestId("payment-history-next").click();
    await expect(page.locator("tbody tr")).toHaveCount(4);
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await page.getByTestId("payment-history-prev").click();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    const exportHref = await page.getByTestId("payment-history-export").getAttribute("href");
    expect(exportHref).toBe(`/api/rooms/${room.id}/payments/export`);
    const exportResponse = await page.request.get(exportHref!);
    expect(exportResponse.status()).toBe(200);
    expect(exportResponse.headers()["content-type"]).toContain("text/csv");
    const exportBody = await exportResponse.text();
    expect(exportBody).toContain(tenantName);
    expect(exportBody).toContain("Payer Name");
    await assertAppHealthy(page, monitor, "payment history pagination and export work");

    const refundDue = new Date();
    refundDue.setDate(refundDue.getDate() + 30);

    monitor.reset();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "End Tenancy" }).click();
    await expect(page.getByRole("heading", { name: "Assign Tenant" })).toBeVisible();
    const warning = page.getByTestId("deposit-refund-warning");
    await expect(warning).toContainText("Deposit return");
    await expect(warning).toContainText(tenantName);
    await expect(warning).toContainText(formatDateLabel(refundDue));
    await assertAppHealthy(page, monitor, "refund due warning appears after tenancy end");

    monitor.reset();
    const compactManager = page.getByTestId("deposit-manager-compact");
    await compactManager.getByTestId("deposit-update-button").click();
    await expect(page.getByTestId("deposit-update-modal")).toBeVisible();
    await compactManager.getByTestId("deposit-action-type").selectOption("DEDUCTION");
    await compactManager.getByTestId("deposit-action-amount").fill("200");
    await compactManager.getByTestId("deposit-action-description").fill("Cleaning deduction");
    await compactManager.getByTestId("deposit-action-submit").click();
    await expect(compactManager.getByTestId("deposit-deductions-total")).toContainText("€200");
    await expect(compactManager.getByTestId("deposit-outstanding-refund")).toContainText("€1,034");

    await compactManager.getByTestId("deposit-update-button").click();
    await expect(page.getByTestId("deposit-update-modal")).toBeVisible();
    await compactManager.getByTestId("deposit-action-type").selectOption("REFUND");
    await compactManager.getByTestId("deposit-action-amount").fill("1034");
    await compactManager.getByTestId("deposit-action-description").fill("Net refund sent");
    await compactManager.getByTestId("deposit-action-submit").click();
    await expect(page.getByTestId("deposit-refund-warning")).toHaveCount(0);
    await assertAppHealthy(page, monitor, "deduction and refund recorded");

    monitor.reset();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Assign Tenant" })).toBeVisible();
    await expect(page.getByTestId("deposit-refund-warning")).toHaveCount(0);
    await assertAppHealthy(page, monitor, "ended tenancy state persists after reload");
  } finally {
    if (propertyUrl) {
      await archiveProperty(page, propertyUrl);
    }
  }
});
