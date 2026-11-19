import { defineConfig } from '@playwright/test'
import config from './playwright.real.config'
export default defineConfig({
  ...config,
  testMatch: '**/*.docker.ts',
  outputDir: './test-results/docker',
})
