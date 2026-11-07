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
 * Chaque locale est capturée après bascule réelle de la langue app (Header).
 * On attend le contenu métier (pas le spinner Suspense) avant screenshot.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const DEMO_EMAIL = process.env.TUTORIAL_DEMO_EMAIL || 'tutorial-demo@example.invalid';
const DEMO_PASSWORD =
  process.env.TUTORIAL_DEMO_PASSWORD || 'TutorialDemo!234';

const repoRoot = path.resolve(__dirname, '../../..');
const outRoot = path.join(repoRoot, 'frontend/public/tutorials');

const LOCALES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

const STEPS: Array<{
  slug: string;
  step: number;
  hash: string;
  ready: (page: Page, locale: LocaleCode) => Promise<void>;
}> = [
  {
    slug: 'getting-started',
    step: 1,
    hash: '#accounts',
    ready: async (page, locale) => {
      const label = locale === 'fr' ? /Nouveau compte/i : /New Account/i;
      await expect(page.getByRole('button', { name: label }).first()).toBeVisible({
        timeout: 60_000,
      });
      // Compte seedé : peut être dans un panneau desktop hors viewport mobile-first
      await expect(appMain(page).getByText(/Demo Futures|Futures Account/i).first()).toBeAttached({
        timeout: 30_000,
      });
    },
  },
  {
    slug: 'getting-started',
    step: 2,
    hash: '#trades',
    ready: async (page) => {
      await expect(appMain(page)).toBeVisible({ timeout: 30_000 });
      // Doublons mobile/desktop : attached suffit (visible=false sur le clone caché)
      await expect(appMain(page).getByText(/NQH6|ESH6/i).first()).toBeAttached({
        timeout: 60_000,
      });
    },
  },
  {
    slug: 'getting-started',
    step: 3,
    hash: '#dashboard',
    ready: async (page, locale) => {
      const region =
        locale === 'fr' ? /Filtres du tableau de bord/i : /Dashboard filters/i;
      await expect(page.getByRole('region', { name: region })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText(/Total Trades|TOTAL TRADES|Total trades/i).first()).toBeVisible({
        timeout: 60_000,
      });
    },
  },
  {
    slug: 'getting-started',
    step: 4,
    hash: '#daily-journal',
    ready: async (page, locale) => {
      const create = locale === 'fr' ? /Cr[eé]er/i : /Create/i;
      await expect(page.getByRole('button', { name: create }).first()).toBeVisible({
        timeout: 60_000,
      });
      await expect(
        page.getByText(/Nouvelle entr|New entr|Entrees|Entries|Mois|Months/i).first()
      ).toBeVisible({ timeout: 60_000 });
    },
  },
  {
    slug: 'import-trades',
    step: 1,
    hash: '#trades',
    ready: async (page, locale) => {
      await expect(appMain(page).getByText(/NQH6|ESH6/i).first()).toBeAttached({
        timeout: 60_000,
      });
      await openImportModal(page, locale);
      // Step 1 = zone fichier / compte, guide replié pour distinguer du step 2
      await setFormatGuideOpen(page, locale, false);
      await expect(
        page.getByText(/Glissez-déposez|Drag and drop/i).first()
      ).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    slug: 'import-trades',
    step: 2,
    hash: '#trades',
    ready: async (page, locale) => {
      await openImportModal(page, locale);
      await setFormatGuideOpen(page, locale, true);
      await expect(
        page.getByText(/Guide de format CSV|CSV Format Guide/i).first()
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/ContractName/i).first()).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    slug: 'calendar',
    step: 1,
    hash: '#calendar',
    ready: async (page, locale) => {
      await closeImportModal(page);
      await closeDayTradesModal(page);
      // « Aujourd’hui » n’apparaît que si on n’est pas déjà sur le mois courant
      await expect(
        page.getByRole('button', { name: locale === 'fr' ? /Quotidienne/i : /Daily/i }).first()
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({
        timeout: 30_000,
      });
      // Cases avec trades seedés : bouton œil « Voir les trades »
      await expect(
        page.getByRole('button', { name: locale === 'fr' ? /Voir les trades/i : /View trades/i }).first()
      ).toBeVisible({ timeout: 60_000 });
    },
  },
  {
    slug: 'calendar',
    step: 2,
    hash: '#calendar',
    ready: async (page, locale) => {
      await closeImportModal(page);
      await openDayTradesModal(page, locale);
      await expect(
        page.getByRole('heading', {
          name: locale === 'fr' ? /Trades du jour/i : /Day Trades/i,
        })
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/NQH6|ESH6/i).first()).toBeVisible({ timeout: 30_000 });
    },
  },
];

/** Évite le <main> de l’overlay ESLint Vite (`window window-collapsed`). */
function appMain(page: Page) {
  return page.getByRole('main').first();
}

async function openImportModal(page: Page, locale: LocaleCode) {
  const title = locale === 'fr' ? /Importer des trades/i : /Import Trades/i;
  const heading = page.getByRole('heading', { name: title });
  if (await heading.isVisible().catch(() => false)) {
    return;
  }
  const importBtn = page
    .getByRole('button', { name: locale === 'fr' ? /^Importer$/i : /^Import$/i })
    .first();
  await expect(importBtn).toBeVisible({ timeout: 30_000 });
  await importBtn.click();
  await expect(heading).toBeVisible({ timeout: 15_000 });
}

async function setFormatGuideOpen(page: Page, locale: LocaleCode, open: boolean) {
  const hideLabel = locale === 'fr' ? /Masquer le guide de format/i : /Hide format guide/i;
  const showLabel = locale === 'fr' ? /Voir le guide de format/i : /Show format guide/i;
  const hideBtn = page.getByRole('button', { name: hideLabel });
  const showBtn = page.getByRole('button', { name: showLabel });
  const guideVisible = await page
    .getByText(/Guide de format CSV|CSV Format Guide/i)
    .first()
    .isVisible()
    .catch(() => false);

  if (open && !guideVisible) {
    await expect(showBtn).toBeVisible({ timeout: 10_000 });
    await showBtn.click();
    await expect(
      page.getByText(/Guide de format CSV|CSV Format Guide/i).first()
    ).toBeVisible({ timeout: 10_000 });
  } else if (!open && guideVisible) {
    await expect(hideBtn).toBeVisible({ timeout: 10_000 });
    await hideBtn.click();
    await expect(
      page.getByText(/Guide de format CSV|CSV Format Guide/i).first()
    ).toBeHidden({ timeout: 10_000 });
  }
}

async function closeFixedModal(page: Page, heading: RegExp) {
  const modal = page.locator('div.fixed.inset-0.z-50').filter({ has: page.getByRole('heading', { name: heading }) });
  if (!(await modal.isVisible().catch(() => false))) {
    return;
  }
  // Clic hors carte (backdrop) — Escape souvent non branché
  await modal.click({ position: { x: 4, y: 4 } });
  await expect(modal).toBeHidden({ timeout: 10_000 });
}

async function closeImportModal(page: Page) {
  await closeFixedModal(page, /Importer des trades|Import Trades/i);
}

async function closeDayTradesModal(page: Page) {
  await closeFixedModal(page, /Trades du jour|Day Trades/i);
}

async function openDayTradesModal(page: Page, locale: LocaleCode) {
  const title = locale === 'fr' ? /Trades du jour/i : /Day Trades/i;
  const heading = page.getByRole('heading', { name: title });
  if (await heading.isVisible().catch(() => false)) {
    return;
  }
  const viewTrades = page
    .getByRole('button', { name: locale === 'fr' ? /Voir les trades/i : /View trades/i })
    .first();
  await expect(viewTrades).toBeVisible({ timeout: 60_000 });
  await viewTrades.click();
  await expect(heading).toBeVisible({ timeout: 15_000 });
}

async function dismissOverlays(page: Page) {
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

async function waitSpinnersGone(page: Page) {
  // Pas d'evaluateAll ici : peut rester coincé si React remonte pendant la nav hash.
  // On plafonne à ~8s puis on continue (ticker / loaders décoratifs possibles).
  const spins = page.locator('.animate-spin');
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const count = await spins.count().catch(() => 0);
    if (count === 0) return;
    let anyVisible = false;
    for (let i = 0; i < count; i += 1) {
      if (await spins.nth(i).isVisible().catch(() => false)) {
        anyVisible = true;
        break;
      }
    }
    if (!anyVisible) return;
    await page.waitForTimeout(250);
  }
}

/** Navigation hash SPA sans attendre `load` (évite les blocages HMR / WS). */
async function goHash(page: Page, hash: string) {
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  const url = page.url();
  if (url.includes(target)) {
    await page.waitForTimeout(200);
    return;
  }
  await page.evaluate((h) => {
    window.location.hash = h;
  }, target);
  await page.waitForFunction((h) => window.location.hash === h, target, { timeout: 15_000 });
  await page.waitForTimeout(400);
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Se connecter|Log in|Sign in/i }).first().click();
  await page.getByLabel(/Email/i).fill(DEMO_EMAIL);
  await page.getByLabel(/Mot de passe|Password/i).fill(DEMO_PASSWORD);
  await page.locator('form').getByRole('button', { name: /Se connecter|Log in|Sign in/i }).click();
  await expect(page).toHaveURL(/#(dashboard|accounts|help)/, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await dismissOverlays(page);
}

async function setUiLanguage(page: Page, locale: (typeof LOCALES)[number]) {
  await closeImportModal(page);
  await closeDayTradesModal(page);
  await dismissOverlays(page);
  const langButton = page.getByRole('button', { name: /Language|Langue|Idioma|Sprache/i }).first();
  await langButton.click();
  await page.getByRole('button', { name: locale.label }).click();
  await page.waitForTimeout(800);
  if (locale.code === 'en') {
    await expect(page.getByRole('button', { name: /Help/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  } else {
    await expect(page.getByRole('button', { name: /Aide/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  }
}

/** Rejette les captures quasi blanches (page encore en chargement / spinner). */
function assertScreenshotNotBlank(filePath: string) {
  const script = `
from PIL import Image
im = Image.open(${JSON.stringify(filePath)}).convert("L")
w, h = im.size
assert w >= 1400 and h >= 800, f"trop petit: {w}x{h}"
# Échantillonnage (pas tous les pixels) : évite de bloquer sur 3200x2000
step = max(1, (w * h) // 80_000)
pixels = list(im.getdata())[::step]
mean = sum(pixels) / len(pixels)
var = sum((p - mean) ** 2 for p in pixels) / len(pixels)
dark_ratio = sum(1 for p in pixels if p < 200) / len(pixels)
# UI claire = mean élevé OK ; un loader blanc n'a ni contraste ni chrome sombre
assert var > 600, f"trop uniforme var={var:.1f} mean={mean:.1f}"
assert dark_ratio > 0.03, f"pas assez de contraste UI dark_ratio={dark_ratio:.3f}"
print(f"ok {w}x{h} mean={mean:.1f} var={var:.1f} dark={dark_ratio:.3f}")
`;
  execFileSync('python3', ['-c', script], { stdio: 'inherit' });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => {
          // eslint-disable-next-line no-console
          console.warn(`[tutorials] timeout ${label} after ${ms}ms`);
          resolve(undefined);
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function captureStep(page: Page, target: string) {
  await expect(appMain(page)).toBeVisible({ timeout: 30_000 });
  // Pas de scrollIntoViewIfNeeded : sur #trades le layout bouge (table) et l’action ne résout jamais.
  await page.waitForTimeout(800);
  // eslint-disable-next-line no-console
  console.log(`[tutorials] screenshot → ${target}`);
  await withTimeout(
    page.screenshot({
      path: target,
      fullPage: false,
      animations: 'disabled',
    }),
    30_000,
    'screenshot'
  );
  if (!fs.existsSync(target)) {
    throw new Error(`screenshot manquant: ${target}`);
  }
  assertScreenshotNotBlank(target);
}

test.describe('Tutorials screenshots (manual)', () => {
  test('capture getting-started + import-trades + calendar FR+EN', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Captures Chromium only');

    await login(page);

    const digestsByLocale: Record<string, string[]> = {};

    for (const locale of LOCALES) {
      await setUiLanguage(page, locale);

      const localeDir = path.join(outRoot, locale.code);
      fs.mkdirSync(localeDir, { recursive: true });
      digestsByLocale[locale.code] = [];

      for (const step of STEPS) {
        // eslint-disable-next-line no-console
        console.log(`[tutorials] ${locale.code} ${step.slug}#${step.step} → ${step.hash}`);
        await goHash(page, step.hash);
        await dismissOverlays(page);
        // eslint-disable-next-line no-console
        console.log(`[tutorials] ${locale.code} ${step.slug}#${step.step} settled, waiting ready`);
        await waitSpinnersGone(page);
        await step.ready(page, locale.code);
        // eslint-disable-next-line no-console
        console.log(`[tutorials] ${locale.code} ${step.slug}#${step.step} ready ok`);
        await waitSpinnersGone(page);

        const target = path.join(localeDir, `${step.slug}-step-${step.step}.png`);

        let lastError: unknown;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await page.waitForTimeout(500 * attempt);
            await captureStep(page, target);
            lastError = undefined;
            break;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(
              `[tutorials] ${locale.code} ${step.slug}#${step.step} attempt ${attempt} failed`,
              err
            );
            lastError = err;
          }
        }
        if (lastError) {
          throw lastError;
        }
        expect(fs.existsSync(target)).toBeTruthy();
        digestsByLocale[locale.code].push(fs.readFileSync(target).toString('binary'));
        // eslint-disable-next-line no-console
        console.log(`[tutorials] wrote ${target}`);
      }

      await closeImportModal(page);
      await closeDayTradesModal(page);
    }

    const frJoined = digestsByLocale.fr.join('|');
    const enJoined = digestsByLocale.en.join('|');
    expect(frJoined).not.toEqual(enJoined);

    await setUiLanguage(page, LOCALES[0]);
    await goHash(page, '#help');
    await expect(page.getByTestId('help-page')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('help-card-calendar').click();
    await expect(page.getByTestId('tutorial-viewer-calendar')).toBeVisible();
  });
});
