import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.mjs",
  outputDir: "./test-results/browser",
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4174", trace: "off", screenshot: "off" },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    env: {
      PAGE_PORT: "4174",
      KITCHENWARE_APP_URL: "http://127.0.0.1:5173/login",
    },
    timeout: 20000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
