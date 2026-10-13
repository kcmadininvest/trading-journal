import { test, expect } from '@playwright/test';

test('Chromium démarre', async ({ page }) => {
  await page.goto('about:blank');
  expect(await page.title()).toBe('');
});
