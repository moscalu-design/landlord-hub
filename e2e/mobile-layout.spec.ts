import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers/auth";
import { resolveOccupiedRoomPath } from "./helpers/fixtures";
import { attachAppMonitor, assertAppHealthy } from "./helpers/monitor";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => el.getBoundingClientRect().width > window.innerWidth + 1)
      .map((el) => ({
        tag: el.tagName,
        width: Math.round(el.getBoundingClientRect().width),
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      }))
  );

  expect(overflow).toEqual([]);
}

test("mobile payments and room pages avoid horizontal overflow", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });

  const monitor = attachAppMonitor(page);
  await login(page);
  monitor.reset();

  await page.goto("/payments", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await assertAppHealthy(page, monitor, "mobile payments page");

  monitor.reset();
  const roomPath = await resolveOccupiedRoomPath(page, monitor);
  test.skip(!roomPath, "No occupied room fixture is available.");

  await page.goto(roomPath!, { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await assertAppHealthy(page, monitor, `mobile room page ${roomPath}`);
});
