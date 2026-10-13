import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const apiURL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8100';
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'login',
      testMatch: /login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts|login\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, '.auth/user.json'),
      },
    },
  ],
  webServer: [
    {
      command: 'bash -lc "source venv/bin/activate && python manage.py runserver 127.0.0.1:8100 --noreload"',
      cwd: path.join(repoRoot, 'backend'),
      env: {
        ...process.env,
        DJANGO_SETTINGS_MODULE: 'trading_journal_api.settings_e2e',
      },
      url: `${apiURL}/admin/login/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 3100 --strictPort',
      cwd: path.join(repoRoot, 'frontend'),
      env: {
        ...process.env,
        VITE_API_URL: apiURL,
      },
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
