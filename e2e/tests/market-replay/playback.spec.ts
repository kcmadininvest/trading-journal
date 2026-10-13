import { test, expect } from '@playwright/test';
import { apiContext, findMarketReplayTarget, login } from '../../helpers/api';

test('lecture, pause et avance du market replay', async ({ page }) => {
  const api = await apiContext();
  const { access } = await login(api);
  const target = await findMarketReplayTarget(api, access);
  await api.dispose();
  test.skip(!target, 'Aucune séance de barres pour le compte de test.');

  await page.goto(`/#market-replay?instrument=${encodeURIComponent(target!.instrument)}&date=${target!.date}`);
  const play = page.getByRole('button', { name: 'Lecture' }).first();
  await expect(play).toBeEnabled({ timeout: 30_000 });
  const clock = page.getByTestId('market-replay-clock');
  await play.click();
  await expect(page.getByRole('button', { name: 'Pause' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Pause' }).first().click();
  const before = (await clock.textContent()) ?? '';
  await page.getByRole('button', { name: 'Bougie suivante' }).first().click();
  await expect(clock).not.toHaveText(before);
});
