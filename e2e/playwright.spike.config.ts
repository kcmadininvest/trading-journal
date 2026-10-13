import { defineConfig, devices } from '@playwright/test';

/** Spike navigateur : pas de serveurs, pas de base, pas de clone. */
export default defineConfig({
  testDir: './spike',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
  },
});
