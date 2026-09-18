import { defineConfig, devices } from "@playwright/test";

const repoRoot = process.cwd();
const port = 3000;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: `${repoRoot}/e2e`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // TABLE_CREATE_LIMIT: the suite creates tables far faster than a venue does,
    // and every page shares 127.0.0.1, so the production guard would throttle it.
    command: `VITE_SYNC_URL=/ pnpm build && PERSIST=memory PORT=${port} TABLE_CREATE_LIMIT=1000 node apps/sync/dist/main.js`,
    cwd: repoRoot,
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
