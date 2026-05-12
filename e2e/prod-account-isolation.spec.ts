import crypto from "node:crypto";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

const ADMIN_EMAIL = "admin@landlord.com";
const ADMIN_PASSWORD = "admin123";
const RUN_ID = process.env.E2E_RUN_ID ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const PASSWORD = process.env.E2E_PROD_TEST_PASSWORD ?? `Codex-${RUN_ID}-Test!42`;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(secret: string) {
  const normalized = secret.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) throw new Error("Invalid TOTP secret.");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string, now = Date.now()) {
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function zipEntries(buffer: Buffer) {
  const entries: Record<string, Buffer> = {};
  let offset = 0;
  while (offset < buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const dataStart = nameStart + nameLength + extraLength;
    entries[name] = buffer.subarray(dataStart, dataStart + compressedSize);
    offset = dataStart + compressedSize;
  }
  return entries;
}

function entryText(entries: Record<string, Buffer>, suffix: string) {
  const key = Object.keys(entries).find((entry) => entry.endsWith(suffix));
  expect(key, `missing ZIP entry ending with ${suffix}`).toBeTruthy();
  return entries[key!].toString("utf8").replace(/^\uFEFF/, "");
}

async function signup(page: Page, account: { name: string; email: string; phone: string }) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.locator('input[name="name"]').fill(account.name);
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="phone"]').fill(account.phone);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirmPassword"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login\?signup=success$/);
}

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 20_000 }),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function logout(page: Page) {
  await page.goto("/settings", { waitUntil: "networkidle" });
  const signOut = page.getByRole("button", { name: /sign out/i });
  if (await signOut.count()) {
    await Promise.all([
      page.waitForURL("**/login"),
      signOut.click(),
    ]);
    return;
  }
  await page.context().clearCookies();
}

async function createProperty(page: Page, name: string) {
  await page.goto("/properties/new", { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="address"]').fill(`${RUN_ID} Test Street`);
  await page.locator('input[name="city"]').fill("Luxembourg");
  await page.locator('input[name="postcode"]').fill("L-0000");
  await page.locator('select[name="propertyType"]').selectOption("OTHER");
  await page.locator('textarea[name="notes"]').fill(`CODEx isolation test ${RUN_ID}`);
  await page.getByRole("button", { name: "Create Property" }).click();
  await expect(page).toHaveURL(/\/properties\/[^/]+$/);
  await expect(page.locator("h1")).toHaveText(name);
  const url = new URL(page.url());
  return { id: url.pathname.split("/").pop()!, url: url.pathname, name };
}

async function createRoom(page: Page, propertyId: string, name: string) {
  await page.goto(`/properties/${propertyId}/rooms/new`, { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="monthlyRent"]').fill("1000");
  await page.locator('input[name="depositAmount"]').fill("1000");
  await page.locator('textarea[name="notes"]').fill(`CODEx isolation test ${RUN_ID}`);
  await page.getByRole("button", { name: "Create Room" }).click();
  await expect(page).toHaveURL(/\/rooms\/[^/]+$/);
  await expect(page.locator("h1")).toHaveText(name);
  const url = new URL(page.url());
  return { id: url.pathname.split("/").pop()!, url: url.pathname, name };
}

async function createTenant(page: Page, label: string) {
  const firstName = "CODEx";
  const lastName = `${label} ${RUN_ID}`;
  const emailLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await page.goto("/tenants/new", { waitUntil: "networkidle" });
  await page.locator('input[name="firstName"]').fill(firstName);
  await page.locator('input[name="lastName"]').fill(lastName);
  await page.locator('input[name="email"]').fill(`codex-tenant-${emailLabel}+${RUN_ID}@example.com`);
  await page.locator('input[name="phone"]').fill("+352 621 111 111");
  await page.locator('textarea[name="notes"]').fill(`CODEx isolation test ${RUN_ID}`);
  await page.getByRole("button", { name: "Create Tenant" }).click();
  await expect(page).toHaveURL(/\/tenants\/[^/]+$/);
  await expect(page.locator("h1")).toHaveText(`${firstName} ${lastName}`);
  const url = new URL(page.url());
  return { id: url.pathname.split("/").pop()!, url: url.pathname, name: `${firstName} ${lastName}` };
}

async function uploadTenantDocument(page: Page, tenantUrl: string) {
  await page.goto(tenantUrl, { waitUntil: "networkidle" });
  const uploadResponse = page.waitForResponse((response) =>
    response.url().includes("/api/documents/upload") && response.request().method() === "POST"
  );
  await page.getByTestId("document-input-idDocument").setInputFiles({
    name: `codex-document-${RUN_ID}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% CODEx harmless dummy document\n"),
  });
  const response = await uploadResponse;
  expect(response.status()).toBe(200);
  const json = await response.json();
  await expect(page.getByTestId("document-slot-idDocument")).toContainText(`codex-document-${RUN_ID}.pdf`);
  return String(json.documentId ?? json.id);
}

async function expectCannotSee(page: Page, text: string) {
  await page.goto("/properties", { waitUntil: "networkidle" });
  await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  await page.goto("/tenants", { waitUntil: "networkidle" });
  await expect(page.getByText(text, { exact: false })).toHaveCount(0);
}

async function assertBlocked(page: Page, path: string, forbiddenText: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.getByText(forbiddenText, { exact: false })).toHaveCount(0);
}

async function exportZip(request: APIRequestContext) {
  const response = await request.get("/api/settings/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/zip");
  return zipEntries(Buffer.from(await response.body()));
}

async function enableTwoFactor(page: Page) {
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Set up 2FA" }).click();
  const secretLocator = page.locator("p.font-mono").last();
  await expect(secretLocator).toBeVisible();
  const secret = (await secretLocator.textContent())?.trim();
  expect(secret).toBeTruthy();
  await page.locator('input[placeholder="123456"]').fill(totp(secret!));
  await page.getByRole("button", { name: "Enable" }).click();
  await expect(page.getByRole("status")).toContainText("Two-factor authentication is enabled.");
  return secret!;
}

test("production account isolation, direct URL blocking, document blocking, admin isolation, and export scoping", async ({ browser }) => {
  test.setTimeout(180_000);

  const userA = {
    name: `CODEx Prod User A ${RUN_ID}`,
    email: `codex-prod-user-a+${RUN_ID}@example.com`,
    phone: "+352 621 000 001",
  };
  const userB = {
    name: `CODEx Prod User B ${RUN_ID}`,
    email: `codex-prod-user-b+${RUN_ID}@example.com`,
    phone: "+352 621 000 002",
  };
  const propertyAName = `CODEx Isolation Property A ${RUN_ID}`;
  const propertyBName = `CODEx Isolation Property B ${RUN_ID}`;

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await signup(pageA, userA);
  await login(pageA, userA.email);
  await pageA.goto("/settings", { waitUntil: "networkidle" });
  await expect(pageA.getByText(userA.phone)).toBeVisible({ timeout: 20_000 });
  const propertyA = await createProperty(pageA, propertyAName);
  const roomA = await createRoom(pageA, propertyA.id, `CODEx Room A ${RUN_ID}`);
  const tenantA = await createTenant(pageA, "Tenant A");
  const documentAId = await uploadTenantDocument(pageA, tenantA.url);
  const userAExport = await exportZip(contextA.request);
  expect(entryText(userAExport, "/csv/properties.csv")).toContain(propertyAName);
  expect(entryText(userAExport, "/csv/properties.csv")).not.toContain(propertyBName);
  expect(entryText(userAExport, "/csv/documents_index.csv")).not.toContain("storageUrl");
  expect(entryText(userAExport, "/csv/account_summary.csv")).not.toContain("twoFactor");

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await signup(pageB, userB);
  await login(pageB, userB.email);
  await pageB.goto("/settings", { waitUntil: "networkidle" });
  await expect(pageB.getByText(userB.phone)).toBeVisible({ timeout: 20_000 });
  await expectCannotSee(pageB, propertyAName);
  await expectCannotSee(pageB, tenantA.name);
  const propertyB = await createProperty(pageB, propertyBName);
  await createRoom(pageB, propertyB.id, `CODEx Room B ${RUN_ID}`);

  await assertBlocked(pageB, propertyA.url, propertyAName);
  await assertBlocked(pageB, roomA.url, roomA.name);
  await assertBlocked(pageB, tenantA.url, tenantA.name);
  const directDoc = await contextB.request.get(`/api/documents/${documentAId}`);
  expect([401, 403, 404]).toContain(directDoc.status());
  const paymentExport = await contextB.request.get(`/api/rooms/${roomA.id}/payments/export`);
  expect([401, 403, 404]).toContain(paymentExport.status());

  const userBExport = await exportZip(contextB.request);
  expect(entryText(userBExport, "/csv/properties.csv")).toContain(propertyBName);
  expect(entryText(userBExport, "/csv/properties.csv")).not.toContain(propertyAName);
  expect(entryText(userBExport, "/csv/tenants.csv")).not.toContain(tenantA.name);

  const userBSecret = await enableTwoFactor(pageB);
  await logout(pageB);
  await pageB.goto("/login", { waitUntil: "networkidle" });
  await pageB.locator('input[name="email"]').fill(userB.email);
  await pageB.locator('input[name="password"]').fill(PASSWORD);
  await pageB.locator('input[name="totpCode"]').fill("000000");
  await pageB.getByRole("button", { name: "Sign in" }).click();
  await expect(pageB).not.toHaveURL(/\/dashboard$/, { timeout: 5_000 });
  await pageB.goto("/login", { waitUntil: "networkidle" });
  await pageB.locator('input[name="email"]').fill(userB.email);
  await pageB.locator('input[name="password"]').fill(PASSWORD);
  await pageB.locator('input[name="totpCode"]').fill(totp(userBSecret));
  await Promise.all([
    pageB.waitForURL("**/dashboard", { timeout: 20_000 }),
    pageB.getByRole("button", { name: "Sign in" }).click(),
  ]);

  await pageA.reload({ waitUntil: "networkidle" });
  await expectCannotSee(pageA, propertyBName);
  await logout(pageA);
  await login(pageA, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expectCannotSee(pageA, propertyAName);
  await expectCannotSee(pageA, propertyBName);
  await pageA.goto("/settings", { waitUntil: "networkidle" });
  await expect(pageA.getByText(/Role:\s*USER/)).toBeVisible();

  await contextA.close();
  await contextB.close();
});
