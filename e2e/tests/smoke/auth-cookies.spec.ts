import { test, expect } from '@playwright/test';
import { TEST_EMAIL, testPassword } from '../../helpers/api';

test.describe('JWT cookies HttpOnly', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login pose tj_access/tj_refresh HttpOnly sans JWT en localStorage', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Se connecter' }).first().click();
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Mot de passe').fill(testPassword());
    await page.locator('form').getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#dashboard/);

    const cookies = await context.cookies();
    const access = cookies.find((c) => c.name === 'tj_access');
    const refresh = cookies.find((c) => c.name === 'tj_refresh');
    expect(access, 'cookie tj_access').toBeTruthy();
    expect(refresh, 'cookie tj_refresh').toBeTruthy();
    expect(access!.httpOnly).toBe(true);
    expect(refresh!.httpOnly).toBe(true);

    const ls = await page.evaluate(() => ({
      access: localStorage.getItem('access_token'),
      refresh: localStorage.getItem('refresh_token'),
      user: localStorage.getItem('user'),
    }));
    expect(ls.access).toBeNull();
    expect(ls.refresh).toBeNull();
    expect(ls.user).toBeTruthy();
  });

  test('session survit au reload sans tokens localStorage', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Se connecter' }).first().click();
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Mot de passe').fill(testPassword());
    await page.locator('form').getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#dashboard/);

    await page.reload();
    await expect(page).toHaveURL(/#dashboard/);
    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'tj_access')).toBe(true);

    const profile = await page.evaluate(async () => {
      const res = await fetch('/api/accounts/profile/', { credentials: 'include' });
      return { ok: res.ok, status: res.status };
    });
    expect(profile.ok).toBe(true);
  });

  test('logout purge les cookies auth', async ({ page, context }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Se connecter' }).first().click();
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Mot de passe').fill(testPassword());
    await page.locator('form').getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/#dashboard/);

    // Bouton icône déconnexion (tooltip « Se déconnecter »)
    await page.locator('header button').filter({ has: page.locator('svg path[d*="M17 16l4-4"]') }).click();

    await expect.poll(async () => {
      const cookies = await context.cookies();
      return cookies.some((c) => c.name === 'tj_access' || c.name === 'tj_refresh');
    }).toBe(false);
  });

  test('session expirée affiche ConfirmModal et CTA auth', async ({ page }) => {
    // Évite le rate-limit login : simule une session locale puis l'event d'expiration.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 1,
          email: 'e2e@localhost',
          username: 'e2e',
          first_name: '',
          last_name: '',
          role: 'user',
          is_verified: true,
          is_active: true,
          is_admin: false,
          is_regular_user: true,
          created_at: '',
          updated_at: '',
        }),
      );
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    });

    await expect(page.getByText(/Session expirée|Session expired/i)).toBeVisible();
    await page.getByRole('button', { name: /Se reconnecter|Sign in again|Iniciar sesión|Erneut anmelden/i }).click();
    await expect(page.getByLabel('Email')).toBeVisible();
  });
});
