import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  E2E_EDITABLE_PROPERTY_ID,
  E2E_OCCUPIED_ROOM_ID,
  E2E_VACANT_ROOM_ID,
} from "./env";
import { assertAppHealthy, type AppMonitor } from "./monitor";

async function collectPropertyPaths(page: Page) {
  await page.goto("/properties", { waitUntil: "networkidle" });
  return page.locator('[data-testid="property-link"]').evaluateAll((nodes) =>
    nodes
      .map((node) => ({
        href: (node as HTMLAnchorElement).getAttribute("href"),
        text: node.textContent ?? "",
      }))
      .filter((entry): entry is { href: string; text: string } => Boolean(entry.href))
      .sort((a, b) => {
        const aIsTest = /\bE2E(?:_TEST)?\b/i.test(a.text);
        const bIsTest = /\bE2E(?:_TEST)?\b/i.test(b.text);
        return Number(aIsTest) - Number(bIsTest);
      })
      .map((entry) => entry.href)
  );
}

export async function resolveOccupiedRoomPath(page: Page, monitor?: AppMonitor) {
  if (E2E_OCCUPIED_ROOM_ID) {
    return `/rooms/${E2E_OCCUPIED_ROOM_ID}`;
  }

  const propertyPaths = await collectPropertyPaths(page);
  for (const propertyPath of propertyPaths) {
    if (!propertyPath) continue;
    await page.goto(propertyPath, { waitUntil: "networkidle" });
    if (monitor) {
      await assertAppHealthy(page, monitor, `property detail ${propertyPath}`);
      monitor.reset();
    }

    const roomPaths = await page.locator('[data-testid="room-link"]').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")).filter(Boolean)
    );

    for (const roomPath of roomPaths) {
      if (!roomPath) continue;
      await page.goto(roomPath, { waitUntil: "networkidle" });
      if (await page.getByRole("heading", { name: "Record Payment" }).count()) {
        return roomPath;
      }
    }
  }

  return null;
}

export async function resolveVacantRoomPath(page: Page, monitor?: AppMonitor) {
  if (E2E_VACANT_ROOM_ID) {
    return `/rooms/${E2E_VACANT_ROOM_ID}`;
  }

  const propertyPaths = await collectPropertyPaths(page);
  for (const propertyPath of propertyPaths) {
    if (!propertyPath) continue;
    await page.goto(propertyPath, { waitUntil: "networkidle" });
    if (monitor) {
      await assertAppHealthy(page, monitor, `property detail ${propertyPath}`);
      monitor.reset();
    }

    const roomPaths = await page.locator('[data-testid="room-link"]').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")).filter(Boolean)
    );

    for (const roomPath of roomPaths) {
      if (!roomPath) continue;
      await page.goto(roomPath, { waitUntil: "networkidle" });
      if (await page.getByRole("heading", { name: "Assign Tenant" }).count()) {
        const tenantOptions = await page.locator('select[name="tenantId"] option').count();
        if (tenantOptions > 1) {
          return roomPath;
        }
      }
    }
  }

  return null;
}

export async function resolveEditablePropertyPath(page: Page) {
  if (E2E_EDITABLE_PROPERTY_ID) {
    return `/properties/${E2E_EDITABLE_PROPERTY_ID}`;
  }

  const propertyPaths = await collectPropertyPaths(page);
  return propertyPaths[0] ?? null;
}

export async function firstNonEmptyOption(select: Locator) {
  const values = await select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      text: (node.textContent ?? "").trim(),
    }))
  );

  const option = values.find((entry) => entry.value);
  expect(option, "expected at least one selectable option").toBeTruthy();
  return option!;
}

export function skipIfMissingFixture(condition: boolean, message: string): asserts condition {
  test.skip(!condition, message);
}
