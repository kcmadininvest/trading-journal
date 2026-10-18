import { test, expect } from '@playwright/test';
import { apiContext, createTradingAccount, deleteTradingAccount, login } from '../../helpers/api';

test('un compte créé par l\'API apparaît puis est retiré', async ({ page }) => {
  const api = await apiContext();
  await login(api);
  const name = `e2e-write-${Date.now()}`;
  const id = await createTradingAccount(api, name);
  try {
    await page.goto('/#accounts');
    await expect(page.getByText(name).first()).toBeVisible();
  } finally {
    await deleteTradingAccount(api, id);
    await api.dispose();
  }
});
