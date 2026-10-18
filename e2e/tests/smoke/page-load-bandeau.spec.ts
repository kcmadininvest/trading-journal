import { test, expect } from '@playwright/test';

const email = process.env.E2E_TEST_EMAIL ?? 'csylvanie@gmail.com';
const password = process.env.E2E_TEST_PASSWORD;

const PAGES = [
  { hash: 'dashboard', maxMs: 8_000 },
  { hash: 'analytics', maxMs: 8_000 },
  { hash: 'strategies', maxMs: 5_000 },
  { hash: 'statistics', maxMs: 8_000 },
  { hash: 'behavior', maxMs: 8_000 },
] as const;

test.describe('chargement bandeau (perf)', () => {
  test.beforeAll(() => {
    if (!password) {
      throw new Error('E2E_TEST_PASSWORD est requis pour page-load-bandeau.');
    }
  });

  test('login puis bandeau TOTAL TRADES sous seuil sur 5 pages', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/');
    await page.getByRole('button', { name: 'Se connecter' }).first().click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mot de passe').fill(password!);
    await page.locator('form').getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#dashboard/, { timeout: 60_000 });

    await page.evaluate(() => {
      localStorage.setItem('strategies_page_active_tab', 'edge');
    });

    const timings: { hash: string; ms: number }[] = [];

    for (const { hash, maxMs } of PAGES) {
      const started = Date.now();
      await page.goto(`/#${hash}`);
      await expect(page).toHaveURL(new RegExp(`#${hash}`));

      const totalTradesLabel = page
        .getByText(/Total Trades|TOTAL TRADES|Total trades/i)
        .first();
      await expect(totalTradesLabel).toBeVisible({ timeout: maxMs });

      const elapsed = Date.now() - started;
      timings.push({ hash, ms: elapsed });
      expect(elapsed, `${hash} bandeau trop lent: ${elapsed}ms (max ${maxMs})`).toBeLessThanOrEqual(
        maxMs,
      );
    }

    console.log(
      'bandeau timings:',
      timings.map((t) => `${t.hash}=${t.ms}ms`).join(', '),
    );
  });
});
