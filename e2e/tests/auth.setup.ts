import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { TEST_EMAIL, testPassword } from '../helpers/api';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authentifier le compte de test (cookies HttpOnly)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).first().click();
  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.getByLabel('Mot de passe').fill(testPassword());
  await page.locator('form').getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/#dashboard/);

  const tokenLeak = await page.evaluate(() => ({
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  }));
  expect(tokenLeak.access).toBeNull();
  expect(tokenLeak.refresh).toBeNull();

  await page.context().storageState({ path: authFile });
});
