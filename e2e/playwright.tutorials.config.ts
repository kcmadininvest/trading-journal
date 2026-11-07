/**
 * Config Playwright dédiée aux captures tutoriels.
 * Pas de globalSetup clone_user_dataset — utiliser seed_tutorial_demo.
 *
 *   cd e2e && npm run tutorials:screenshots
 */
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const djangoURL = process.env.E2E_DJANGO_URL ?? 'http://127.0.0.1:8100';
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  testDir: './tests/tutorials',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    screenshot: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'tutorials-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'bash -lc "source venv/bin/activate && python manage.py migrate --noinput && python manage.py seed_tutorial_demo --reset && python manage.py runserver 127.0.0.1:8100 --noreload"',
      cwd: path.join(repoRoot, 'backend'),
      env: {
        ...process.env,
        DJANGO_SETTINGS_MODULE: 'trading_journal_api.settings_e2e',
      },
      url: `${djangoURL}/admin/login/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run dev -- --port 3100 --strictPort',
      cwd: path.join(repoRoot, 'frontend'),
      env: {
        ...process.env,
        VITE_API_URL: '',
        VITE_DEV_PROXY_TARGET: djangoURL,
        VITE_DEV_PROXY_WS_TARGET: djangoURL.replace(/^http/, 'ws'),
      },
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
