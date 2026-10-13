import { test, expect } from '@playwright/test';

test('navigation par hash vers le tableau de bord et les trades', async ({ page }) => {
  await page.goto('/#dashboard');
  await expect(page).toHaveURL(/#dashboard/);
  await page.getByRole('button', { name: 'Mes Trades' }).first().click();
  await expect(page).toHaveURL(/#trades/);
});
