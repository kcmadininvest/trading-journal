import { test, expect } from '@playwright/test';

test('navigation par hash vers le tableau de bord et les trades', async ({ page }) => {
  await page.goto('/#dashboard');
  await expect(page).toHaveURL(/#dashboard/);
  await expect(page.getByRole('region', { name: /Filtres du tableau de bord/i })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto('/#trades');
  await expect(page).toHaveURL(/#trades/);
  // Contenu authentifié de la page trades (évite la nav mobile groupée <2xl)
  await expect(page.locator('main')).toBeVisible();
});
