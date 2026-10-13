import { test, expect } from '@playwright/test';
import { apiContext, createTradingAccount, deleteTradingAccount, login } from '../../helpers/api';

test('un compte créé par l\'API apparaît puis est retiré', async ({ page }) => {
  const api = await apiContext();
  const { access } = await login(api);
  const name = `e2e-write-${Date.now()}`;
  const id = await createTradingAccount(api, access, name);
  try {
    await page.goto('/#accounts');
    await expect(page.getByText(name).first()).toBeVisible();
  } finally {
    await deleteTradingAccount(api, access, id);
    await api.dispose();
  }
});
