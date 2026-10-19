import { test, expect } from '@playwright/test';

/**
 * Anti-régression sécurité (cookies auth + parcours UI).
 * CSP : assert header si E2E_EXPECT_CSP=1 (vhost Apache) ; sinon skip (Vite e2e).
 */
test.describe('security regression', () => {
  test('parcours dashboard / trades / accounts / settings', async ({ page }) => {
    const scriptSrcViolations: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/content security policy|script-src/i.test(text)) {
        scriptSrcViolations.push(text);
      }
    });

    await page.goto('/#dashboard');
    await expect(page).toHaveURL(/#dashboard/);
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });

    await page.goto('/#trades');
    await expect(page).toHaveURL(/#trades/);
    await expect(page.locator('main')).toBeVisible();

    await page.goto('/#accounts');
    await expect(page).toHaveURL(/#accounts/);
    await expect(page.locator('main')).toBeVisible();

    await page.goto('/#settings');
    await expect(page).toHaveURL(/#settings/);
    await expect(page.locator('main')).toBeVisible();

    if (process.env.E2E_CSP_ENFORCE === '1') {
      expect(scriptSrcViolations, scriptSrcViolations.join('\n')).toEqual([]);
    } else if (scriptSrcViolations.length) {
      console.warn('[CSP Report-Only/dev] script-src messages:', scriptSrcViolations);
    }
  });

  test('document CSP header quand E2E_EXPECT_CSP=1', async ({ page }) => {
    test.skip(process.env.E2E_EXPECT_CSP !== '1', 'CSP header uniquement derrière Apache');

    const response = await page.goto('/');
    expect(response).toBeTruthy();
    const csp =
      response!.headers()['content-security-policy'] ||
      response!.headers()['content-security-policy-report-only'];
    expect(csp, 'header CSP manquant').toBeTruthy();
    expect(csp).toMatch(/script-src/);
  });

  test.describe('sans session', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('home publique 200', async ({ page }) => {
      const response = await page.goto('/');
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('button', { name: 'Se connecter' }).first()).toBeVisible();
    });
  });
});
