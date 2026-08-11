import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests, run on all three engines.
 *
 * The unit suite covers the logic; these cover the things only a real browser
 * can answer — that IndexedDB actually persists across a reload, that Enter
 * genuinely commits, that the layout holds at 360px. Running them on WebKit as
 * well as Chromium matters more than usual here: mobile Safari is the browser
 * the 16px capture field and the touch targets were designed around.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"]],

  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],

  /**
   * Tested against a production build rather than the dev server. Dev ships
   * different bundles, different error overlays and no minification, so a
   * green dev run says less than it appears to.
   */
  webServer: {
    command: "npm run build && npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // The suite is served over plain HTTP, so the production CSP's
    // `upgrade-insecure-requests` has to stand down. WebKit honours it even on
    // localhost and would otherwise fail to load a single script. Nothing else
    // about the policy changes.
    env: { TALLY_ALLOW_INSECURE: "1" },
  },
});
