import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './ui-tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
