/**
 * Captures manuelles des tutoriels (données fictives seed_tutorial_demo).
 *
 * Ne lance PAS la suite smoke. Respecte playwright-manual-only.
 *
 * Prérequis :
 *   1. Backend + frontend (ou laisser Playwright démarrer via playwright.tutorials.config.ts)
 *   2. Seed :
 *        cd backend && source venv/bin/activate
 *        DJANGO_SETTINGS_MODULE=trading_journal_api.settings_e2e \
 *          python manage.py seed_tutorial_demo --reset
 *   3. Lancer :
 *        cd e2e && npm run tutorials:screenshots
 *
 * Sortie : frontend/public/tutorials/<locale>/<slug>-step-<n>.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const DEMO_EMAIL = process.env.TUTORIAL_DEMO_EMAIL || 'tutorial-demo@example.invalid';
const DEMO_PASSWORD =
  process.env.TUTORIAL_DEMO_PASSWORD || 'TutorialDemo!234';

const repoRoot = path.resolve(__dirname, '../../..');
const outRoot = path.join(repoRoot, 'frontend/public/tutorials');

const LOCALES = ['fr', 'en'] as const;

const STEPS: Array<{ slug: string; step: number; hash: string; ready: string }> = [
  {
    slug: 'getting-started',
    step: 1,
    hash: '#accounts',
    ready: 'body',
  },
  {
    slug: 'getting-started',
    step: 2,
    hash: '#trades',
    ready: 'body',
  },
  {
    slug: 'getting-started',
    step: 3,
    hash: '#dashboard',
    ready: 'body',
  },
  {
    slug: 'getting-started',
    step: 4,
    hash: '#daily-journal',
    ready: 'body',
  },
];

async function dismissOverlays(page: import('@playwright/test').Page) {
  for (let i = 0; i < 3; i += 1) {
    const later = page.getByRole('button', { name: /Plus tard|Later|Don’t show|Ne plus/i }).first();
    if (await later.isVisible().catch(() => false)) {
      await later.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
      continue;
    }
    const goAccounts = page.getByRole('button', { name: /Aller aux comptes|Go to accounts/i });
    if (await goAccounts.isVisible().catch(() => false)) {
      await goAccounts.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
      continue;
    }
    break;
  }
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Se connecter|Log in|Sign in/i }).first().click();
  await page.getByLabel(/Email/i).fill(DEMO_EMAIL);
  await page.getByLabel(/Mot de passe|Password/i).fill(DEMO_PASSWORD);
  await page.locator('form').getByRole('button', { name: /Se connecter|Log in|Sign in/i }).click();
  await expect(page).toHaveURL(/#(dashboard|accounts|help)/, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await dismissOverlays(page);
}

test.describe('Tutorials screenshots (manual)', () => {
  test('capture P0 getting-started FR+EN', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Captures Chromium only');

    await login(page);

    for (const locale of LOCALES) {
      // Prefer URL lang when supported; otherwise change via preferences UI is heavy —
      // we capture DOM in current locale and write under both folders with a note that
      // EN may need a second pass after switching language in Settings.
      const localeDir = path.join(outRoot, locale);
      fs.mkdirSync(localeDir, { recursive: true });

      for (const step of STEPS) {
        await page.goto(`/${locale === 'en' ? '?lang=en' : '?lang=fr'}${step.hash}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(800);
        const target = path.join(localeDir, `${step.slug}-step-${step.step}.png`);
        await page.screenshot({
          path: target,
          fullPage: false,
        });
        expect(fs.existsSync(target)).toBeTruthy();
      }
    }

    // Hub aide (sanity)
    await page.goto('/?lang=fr#help');
    await expect(page.getByTestId('help-page')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('help-card-getting-started').click();
    await expect(page.getByTestId('tutorial-viewer-getting-started')).toBeVisible();
  });
});
