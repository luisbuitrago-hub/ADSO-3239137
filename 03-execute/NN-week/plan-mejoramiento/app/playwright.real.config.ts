import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results/live',
  testMatch: '**/*.real.ts',
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.KITCHENWARE_TEST_URL,
    trace: 'off',
    screenshot: 'off',
  },
})
