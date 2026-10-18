import { defineConfig, devices } from '@playwright/test';

/**
 * Recette perf contre l'app déjà servie (ex. localhost:3000).
 * Pas de globalSetup (clone_user_dataset), pas de webServer e2e.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-perf',
      testMatch: /page-load-bandeau\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
