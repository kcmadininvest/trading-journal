import path from 'node:path';
import { test as setup } from '@playwright/test';
import { apiContext, login } from '../helpers/api';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authentifier le compte de test', async ({ page }) => {
  const api = await apiContext();
  try {
    const payload = await login(api);
    await page.goto('/');
    await page.evaluate((data) => {
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));
    }, payload);
    await page.context().storageState({ path: authFile });
  } finally {
    await api.dispose();
  }
});
