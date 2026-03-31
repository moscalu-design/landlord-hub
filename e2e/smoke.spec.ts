import { test } from "@playwright/test";
import { login } from "./helpers/auth";
import { collectSafeInternalLinks } from "./helpers/navigation";
import { assertAppHealthy, attachAppMonitor } from "./helpers/monitor";

const MAIN_ROUTES = ["/dashboard", "/properties", "/tenants", "/payments", "/settings"];
const MAX_VISITS = 16;

test("authenticated smoke navigation covers core pages safely", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const monitor = attachAppMonitor(page);
  const queue = [...MAIN_ROUTES];
  const visited = new Set<string>();

  await login(page);
  monitor.reset();

  while (queue.length > 0 && visited.size < MAX_VISITS) {
    const path = queue.shift();
    if (!path || visited.has(path)) continue;

    visited.add(path);
    await page.goto(path, { waitUntil: "networkidle" });
    await assertAppHealthy(page, monitor, `smoke visit ${path}`);

    if (path === "/payments") {
      await page.getByRole("button", { name: "Filter" }).click();
      await assertAppHealthy(page, monitor, "payments filter");
    }

    const discoveredLinks = await collectSafeInternalLinks(page);
    for (const link of discoveredLinks) {
      if (!visited.has(link.href) && !queue.includes(link.href)) {
        queue.push(link.href);
      }
    }

    monitor.reset();
  }

  await testInfo.attach("visited-pages", {
    body: JSON.stringify(Array.from(visited), null, 2),
    contentType: "application/json",
  });
});
