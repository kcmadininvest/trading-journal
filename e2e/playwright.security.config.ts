import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Campagne sécurité sur la stack qualif déjà en mémoire :
 * - Frontend Vite existant : http://127.0.0.1:3000 (pas de 2e Vite = évite OOM)
 * - Daphne qualif : http://127.0.0.1:8001 (proxy Vite par défaut)
 *
 * Ne démarre aucun webServer lourd. Prérequis : migrate 0033 + user security-e2e.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/security',
  fullyParallel: false,
  workers: 1,
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
      name: 'security-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
