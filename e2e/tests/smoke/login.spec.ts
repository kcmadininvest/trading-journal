import { test, expect } from '@playwright/test';
import { TEST_EMAIL, testPassword } from '../../helpers/api';

test('connexion depuis l\'écran d\'accueil', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).first().click();
  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.getByLabel('Mot de passe').fill(testPassword());
  await page.locator('form').getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/#dashboard/);

  const ls = await page.evaluate(() => ({
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  }));
  expect(ls.access).toBeNull();
  expect(ls.refresh).toBeNull();
});
