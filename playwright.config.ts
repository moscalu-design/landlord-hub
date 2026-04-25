import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const useLocalServer = !process.env.PLAYWRIGHT_BASE_URL;
const localDatabaseUrl = `file:${process.cwd()}/dev.db`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
  },
  webServer: useLocalServer
    ? {
        command:
          `DATABASE_URL=${localDatabaseUrl} BLOB_READ_WRITE_TOKEN= LOCAL_FILE_STORAGE_ENABLED=true AUTH_URL=http://127.0.0.1:3000 NEXTAUTH_URL=http://127.0.0.1:3000 npm run dev -- --hostname 127.0.0.1 --port 3000`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
