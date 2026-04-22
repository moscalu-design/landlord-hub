import { expect, test, type Page } from "@playwright/test";
import { E2E_ALLOW_DESTRUCTIVE, E2E_ENTITY_PREFIX } from "./env";

export function requireDestructive() {
  test.skip(!E2E_ALLOW_DESTRUCTIVE, "Set E2E_ALLOW_DESTRUCTIVE=true to run create/delete CRUD coverage.");
}

export function uniqueEntityName(kind: string) {
  return `${E2E_ENTITY_PREFIX} ${kind} ${Date.now()}`;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pathId(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts.at(-1) ?? "";
}

export async function createProperty(page: Page, overrides?: Partial<{
  name: string;
  address: string;
  city: string;
  postcode: string;
  notes: string;
}>) {
  const unique = Date.now();
  const name = overrides?.name ?? uniqueEntityName("Property");
  const address = overrides?.address ?? `${unique} Test Street`;
  const city = overrides?.city ?? "Playwright City";
  const postcode = overrides?.postcode ?? `E2E ${String(unique).slice(-3)}`;
  const notes = overrides?.notes ?? `[${E2E_ENTITY_PREFIX}] property created by Playwright`;

  await page.goto("/properties/new", { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="address"]').fill(address);
  await page.locator('input[name="city"]').fill(city);
  await page.locator('input[name="postcode"]').fill(postcode);
  await page.locator('select[name="propertyType"]').selectOption("OTHER");
  await page.locator('textarea[name="notes"]').fill(notes);
  await page.getByRole("button", { name: "Create Property" }).click();

  await expect(page).toHaveURL(/\/properties\/[^/]+$/, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await expect
    .poll(async () => {
      const headingText = await page.locator("h1").first().textContent();
      return headingText?.trim() ?? "";
    }, { timeout: 15_000 })
    .toBe(name);

  return {
    id: pathId(new URL(page.url()).pathname),
    url: page.url(),
    name,
    address,
    city,
    postcode,
    notes,
  };
}

export async function archiveProperty(page: Page, propertyUrl: string) {
  await page.goto(propertyUrl, { waitUntil: "domcontentloaded" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("archive-property-button").click();
  await expect(page).toHaveURL(/\/properties$/);
}

export async function createRoom(page: Page, propertyId: string, overrides?: Partial<{
  name: string;
  monthlyRent: string;
  depositAmount: string;
  floor: string;
  notes: string;
}>) {
  const name = overrides?.name ?? uniqueEntityName("Room");
  const monthlyRent = overrides?.monthlyRent ?? "1234";
  const depositAmount = overrides?.depositAmount ?? "1234";
  const floor = overrides?.floor ?? "First";
  const notes = overrides?.notes ?? `[${E2E_ENTITY_PREFIX}] room created by Playwright`;

  await page.goto(`/properties/${propertyId}/rooms/new`, { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="floor"]').fill(floor);
  await page.locator('input[name="monthlyRent"]').fill(monthlyRent);
  await page.locator('input[name="depositAmount"]').fill(depositAmount);
  await page.locator('textarea[name="notes"]').fill(notes);
  await page.getByRole("button", { name: "Create Room" }).click();

  await expect(page).toHaveURL(/\/rooms\/[^/]+$/, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await expect
    .poll(async () => {
      const headingText = await page.locator("h1").first().textContent();
      return headingText?.trim() ?? "";
    }, { timeout: 15_000 })
    .toBe(name);

  return {
    id: pathId(new URL(page.url()).pathname),
    url: page.url(),
    name,
    monthlyRent,
    depositAmount,
    floor,
    notes,
  };
}

export async function deleteRoom(page: Page, roomUrl: string) {
  await page.goto(roomUrl, { waitUntil: "domcontentloaded" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("delete-room-button").click();
  await expect(page).toHaveURL(/\/properties\/[^/]+$/);
}

export async function createTenant(page: Page, overrides?: Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  notes: string;
}>) {
  const unique = Date.now();
  const firstName = overrides?.firstName ?? E2E_ENTITY_PREFIX;
  const lastName = overrides?.lastName ?? `Tenant ${unique}`;
  const email = overrides?.email ?? `${E2E_ENTITY_PREFIX.toLowerCase()}+${unique}@example.com`;
  const phone = overrides?.phone ?? "+44 7700 000001";
  const nationality = overrides?.nationality ?? "Test Nationality";
  const notes = overrides?.notes ?? `[${E2E_ENTITY_PREFIX}] tenant created by Playwright`;

  await page.goto("/tenants/new", { waitUntil: "networkidle" });
  await page.locator('input[name="firstName"]').fill(firstName);
  await page.locator('input[name="lastName"]').fill(lastName);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="phone"]').fill(phone);
  await page.locator('input[name="nationality"]').fill(nationality);
  await page.locator('textarea[name="notes"]').fill(notes);
  await page.getByRole("button", { name: "Create Tenant" }).click();

  await expect(page).toHaveURL(/\/tenants\/[^/]+$/);
  await expect(page.locator("h1")).toHaveText(`${firstName} ${lastName}`);

  return {
    id: pathId(new URL(page.url()).pathname),
    url: page.url(),
    firstName,
    lastName,
    email,
    phone,
    nationality,
    notes,
  };
}

export async function deleteTenant(page: Page, tenantUrl: string) {
  await page.goto(tenantUrl, { waitUntil: "domcontentloaded" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("delete-tenant-button").click();
  await expect(page).toHaveURL(/\/tenants$/);
}
