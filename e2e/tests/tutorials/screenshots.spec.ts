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
/** Filtre optionnel : `TUTORIAL_ONLY_SLUG=position-strategies` ne capture que ce tuto. */
const ONLY_SLUG = (process.env.TUTORIAL_ONLY_SLUG || '').trim();

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
  {
    slug: 'api-connections',
    step: 1,
    hash: '#settings',
    ready: async (page, locale) => {
      await closeImportModal(page);
      await closeDayTradesModal(page);
      await openTradingApiSection(page, locale);
      await setApiKeyEditMode(page, locale, false);
      await expect(page.getByText(/TopStepX/i).first()).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText(locale === 'fr' ? /Connecté|Configuré/i : /Connected|Configured/i).first()
      ).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    slug: 'api-connections',
    step: 2,
    hash: '#settings',
    ready: async (page, locale) => {
      await openTradingApiSection(page, locale);
      await setApiKeyEditMode(page, locale, true);
      await expect(
        page.getByPlaceholder(locale === 'fr' ? /Collez votre clé API/i : /Paste your API key/i)
      ).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    slug: 'api-connections',
    step: 3,
    hash: '#settings',
    ready: async (page, locale) => {
      await openTradingApiSection(page, locale);
      await setApiKeyEditMode(page, locale, false);
      await expect(
        page.getByRole('button', {
          name: locale === 'fr' ? /Tester la connexion/i : /Test connection/i,
        })
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByText(locale === 'fr' ? /^Connecté$/i : /^Connected$/i).first()
      ).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    slug: 'api-connections',
    step: 4,
    // Sync desktop : barre d’actions Trades (compte TopStep = défaut seed).
    hash: '#trades',
    ready: async (_page, _locale) => {
      await closeImportModal(_page);
      await selectDemoTopStepAccount(_page);
      await expect(
        _page.getByRole('button', { name: /Synchroniser|\bSync(?:hronize|ing)?\b/i }).first()
      ).toBeVisible({ timeout: 60_000 });
      await expect(appMain(_page).getByText(/Demo TopStep Account/i).first()).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    slug: 'journal-questions',
    step: 1,
    hash: '#settings',
    ready: async (page, locale) => {
      await openQuestionsSettings(page, locale, 'templates');
      // Vue d’ensemble de l’enchaînement : les 3 onglets visibles
      await expect(
        appMain(page).getByRole('button', {
          name: locale === 'fr' ? /Modèles de questions/i : /Question templates/i,
        })
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        appMain(page).getByRole('button', {
          name: locale === 'fr' ? /Questionnaire du jour/i : /Daily questionnaire/i,
        })
      ).toBeVisible();
      await expect(
        appMain(page).getByRole('button', {
          name: locale === 'fr' ? /Questionnaire positions/i : /Position questionnaire/i,
        })
      ).toBeVisible();
    },
  },
  {
    slug: 'journal-questions',
    step: 2,
    hash: '#settings',
    ready: async (page, locale) => {
      await openQuestionsSettings(page, locale, 'templates');
      await expect(appMain(page).getByText(/Comment était ton mindset|As-tu suivi le plan/i).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        appMain(page).getByRole('button', {
          name: locale === 'fr' ? /Nouveau modèle/i : /New template/i,
        })
      ).toBeVisible();
    },
  },
  {
    slug: 'journal-questions',
    step: 3,
    hash: '#settings',
    ready: async (page, locale) => {
      await openQuestionsSettings(page, locale, 'day');
      await expect(appMain(page).getByText(/Comment était ton mindset|As-tu suivi le plan/i).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        appMain(page)
          .getByText(
            locale === 'fr'
              ? /Questions posées une fois par journée/i
              : /Questions asked once per trading day/i
          )
          .first()
      ).toBeVisible();
    },
  },
  {
    slug: 'journal-questions',
    step: 4,
    hash: '#journal-questions',
    ready: async (page, locale) => {
      await closeImportModal(page);
      await selectDemoTopStepAccount(page);
      await expect(
        appMain(page).getByText(/Comment était ton mindset|As-tu suivi le plan/i).first()
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        page.getByRole('link', {
          name: locale === 'fr' ? /Configurer les questions/i : /Configure questions/i,
        })
      ).toBeVisible();
    },
  },
  {
    slug: 'transactions-profitability',
    step: 1,
    hash: '#dashboard',
    ready: async (page, locale) => {
      await openManagementMenu(page, locale);
      await expect(
        page.getByRole('button', { name: locale === 'fr' ? /^Transactions$/i : /^Transactions$/i })
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole('button', {
          name: locale === 'fr' ? /Rentabilité activité/i : /Activity profitability/i,
        })
      ).toBeVisible();
    },
  },
  {
    slug: 'transactions-profitability',
    step: 2,
    hash: '#transactions',
    ready: async (page, locale) => {
      await closeImportModal(page);
      await selectDemoTopStepAccount(page);
      await expect(
        appMain(page).getByRole('heading', {
          name: locale === 'fr' ? /Historique des transactions/i : /Transaction History/i,
        })
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        appMain(page).getByRole('button', {
          name: locale === 'fr' ? /Nouveau dépôt/i : /New Deposit/i,
        })
      ).toBeVisible();
      // Doublons mobile/desktop : attached suffit
      await expect(appMain(page).getByText(/TUTO-DEMO/i).first()).toBeAttached({ timeout: 30_000 });
      await expect(appMain(page).getByText(/10[.,\s]?000/i).first()).toBeAttached();
    },
  },
  {
    slug: 'transactions-profitability',
    step: 3,
    hash: '#trading-activity',
    ready: async (page, locale) => {
      await expect(
        appMain(page).getByRole('heading', {
          name: locale === 'fr' ? /Soldes par devise/i : /Balances by currency/i,
        })
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        appMain(page).getByRole('tab', {
          name: locale === 'fr' ? /^Débit$/i : /^Debit$/i,
        })
      ).toBeVisible({ timeout: 30_000 });
      await expect(appMain(page).getByText(/USD/i).first()).toBeVisible();
    },
  },
  {
    slug: 'transactions-profitability',
    step: 4,
    hash: '#trading-activity',
    ready: async (page, locale) => {
      await expect(
        appMain(page).getByRole('heading', {
          name: locale === 'fr' ? /Soldes par devise/i : /Balances by currency/i,
        })
      ).toBeVisible({ timeout: 60_000 });
      const creditTab = appMain(page).getByRole('tab', {
        name: locale === 'fr' ? /^Crédit$/i : /^Credit$/i,
      });
      await expect(creditTab).toBeVisible({ timeout: 30_000 });
      await creditTab.click();
      await expect(
        appMain(page)
          .getByText(locale === 'fr' ? /Retraits liés/i : /Linked withdrawals/i)
          .first()
      ).toBeAttached({ timeout: 30_000 });
      await expect(appMain(page).getByText(/Demo TopStep Account/i).first()).toBeAttached({
        timeout: 30_000,
      });
      await expect(appMain(page).getByText(/1[.,\s]?500/i).first()).toBeAttached();
    },
  },
  {
    slug: 'position-strategies',
    step: 1,
    hash: '#dashboard',
    ready: async (page, locale) => {
      await openStrategiesMenu(page, locale);
      await expect(
        page.getByRole('button', {
          name: locale === 'fr' ? /Gestion de Stratégie/i : /Strategy Management/i,
        })
      ).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    slug: 'position-strategies',
    step: 2,
    hash: '#position-strategies',
    ready: async (page, locale) => {
      // Pas de h1 page dans le main — titre sync header ; repères liste + CTA.
      await expect(
        appMain(page).getByRole('button', {
          name: locale === 'fr' ? /Nouvelle stratégie/i : /New strategy/i,
        })
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        appMain(page).getByRole('heading', { name: /TUTO-DEMO OR Retrace/i })
      ).toBeVisible({ timeout: 30_000 });
    },
  },
  {
    slug: 'position-strategies',
    step: 3,
    hash: '#position-strategies',
    ready: async (page, locale) => {
      await expect(
        appMain(page).getByRole('heading', { name: /TUTO-DEMO OR Retrace/i })
      ).toBeVisible({ timeout: 60_000 });
      // Bouton Modifier = icône crayon (Tooltip, pas d’accessible name / title).
      const editBtn = appMain(page)
        .locator('button')
        .filter({ has: page.locator('path[d^="M11 5H6"]') })
        .first();
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
      } else {
        await appMain(page)
          .getByRole('button', {
            name: locale === 'fr' ? /Nouvelle stratégie/i : /New strategy/i,
          })
          .click();
      }
      await expect(
        page
          .getByRole('heading', {
            name:
              locale === 'fr'
                ? /Modifier la stratégie|Nouvelle stratégie/i
                : /Edit strategy|New strategy/i,
          })
          .first()
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page
          .getByText(
            locale === 'fr'
              ? /Sections de la stratégie|Ajouter une section/i
              : /Strategy sections|Add a section/i
          )
          .first()
      ).toBeAttached({ timeout: 15_000 });
    },
  },
  {
    slug: 'position-strategies',
    step: 4,
    hash: '#position-strategies',
    ready: async (page, locale) => {
      const cancel = page.getByRole('button', {
        name: locale === 'fr' ? /^Annuler$/i : /^Cancel$/i,
      });
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click();
        await page.waitForTimeout(400);
      }
      await expect(
        appMain(page).getByRole('heading', { name: /TUTO-DEMO OR Retrace/i })
      ).toBeVisible({ timeout: 60_000 });
      // Bouton Versions = horloge + compteur (nom accessible = le chiffre).
      const versionsBtn = appMain(page).getByRole('button', { name: /^[0-9]+$/ }).first();
      await expect(versionsBtn).toBeVisible({ timeout: 15_000 });
      await versionsBtn.click();
      await expect(
        page.getByRole('heading', {
          name: locale === 'fr' ? /Historique des versions/i : /Version history/i,
        })
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/TUTO-DEMO|v\s*\d+|Version\s*\d+/i).first()).toBeAttached();
    },
  },  {
    slug: 'backtest-market-replay',
    step: 1,
    hash: '#dashboard',
    ready: async (page, locale) => {
      await openStrategiesMenu(page, locale);
      await expect(
        page.getByRole('button', {
          name: locale === 'fr' ? /Journal de backtest/i : /Backtest journal/i,
        })
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole('button', { name: /Market Replay/i })
      ).toBeVisible();
    },
  },
  {
    slug: 'backtest-market-replay',
    step: 2,
    hash: '#backtest-journal',
    ready: async (page, locale) => {
      await expect(
        appMain(page).getByRole('heading', {
          name: locale === 'fr' ? /Journal de backtest/i : /Backtest journal/i,
        })
      ).toBeVisible({ timeout: 60_000 });
      await expect(appMain(page).getByText(/TUTO-DEMO OR Retrace/i).first()).toBeAttached({
        timeout: 30_000,
      });
    },
  },
  {
    slug: 'backtest-market-replay',
    step: 3,
    hash: '#historical-data',
    ready: async (page, locale) => {
      // Pas de h1 « Données historiques » dans le main — le titre vit dans le header.
      await expect(
        appMain(page).getByRole('heading', {
          name: locale === 'fr' ? /Mise à jour automatique/i : /Automatic update/i,
        })
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        appMain(page)
          .getByText(
            locale === 'fr'
              ? /Téléchargement historique|TopStepX|Lancer le téléchargement/i
              : /Historical backfill|TopStepX|Start download/i
          )
          .first()
      ).toBeAttached({ timeout: 30_000 });
    },
  },
  {
    slug: 'backtest-market-replay',
    step: 4,
    hash: '#market-replay',
    ready: async (page, locale) => {
      await expect(
        appMain(page).getByRole('heading', { name: /Market Replay/i })
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        appMain(page)
          .getByText(
            locale === 'fr'
              ? /Choisissez un actif|Rejouez l’historique|Lecture/i
              : /Choose an instrument|Replay|Play/i
          )
          .first()
      ).toBeAttached({ timeout: 30_000 });
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

async function closeStrategyModals(page: Page) {
  await closeFixedModal(page, /Historique des versions|Version history/i);
  await closeFixedModal(page, /Modifier la stratégie|Edit strategy|Nouvelle stratégie|New strategy/i);
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

/** Settings ne réécoute pas toujours `?tab=` une fois monté → clic onglet Trading (sidebar). */
async function openTradingApiSection(page: Page, locale: LocaleCode) {
  await goHash(page, '#settings');
  await dismissOverlays(page);
  // Ne pas cibler le menu Header « Trading » (même libellé) — rester dans la sidebar Settings.
  const settingsNav = appMain(page).getByRole('navigation').first();
  const tradingTab = settingsNav.getByRole('button', { name: /^Trading$/i });
  await expect(tradingTab).toBeVisible({ timeout: 30_000 });
  await tradingTab.click();
  const sectionTitle =
    locale === 'fr' ? /Connexions API/i : /API connections/i;
  await expect(appMain(page).getByText(sectionTitle).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(appMain(page).getByText(/TopStepX/i).first()).toBeVisible({
    timeout: 30_000,
  });
  // Bloc API souvent sous la fold — evaluate (pas scrollIntoViewIfNeeded, qui a déjà bloqué ailleurs)
  await appMain(page)
    .getByText(sectionTitle)
    .first()
    .evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  await page.waitForTimeout(300);
}

async function openManagementMenu(page: Page, locale: LocaleCode) {
  await dismissOverlays(page);
  const label = locale === 'fr' ? /^Gestion$/i : /^Management$/i;
  const trigger = page.getByRole('banner').getByRole('button', { name: label });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  // Hover ouvre le menu ; un clic supplémentaire le refermerait (toggle).
  await trigger.hover();
  await page.waitForTimeout(250);
  const profitability = page.getByRole('button', {
    name: locale === 'fr' ? /Rentabilité activité/i : /Activity profitability/i,
  });
  if (!(await profitability.isVisible().catch(() => false))) {
    await trigger.click();
  }
  await expect(profitability).toBeVisible({ timeout: 10_000 });
  await expect(
    page.getByRole('button', { name: /^Transactions$/i })
  ).toBeVisible();
}

async function openStrategiesMenu(page: Page, locale: LocaleCode) {
  await dismissOverlays(page);
  // Fermer un éventuel autre menu (Gestion…) qui resterait ouvert.
  await page.mouse.move(8, 8);
  await page.waitForTimeout(300);
  const label = locale === 'fr' ? /^Stratégies$/i : /^Strategies$/i;
  const trigger = page.getByRole('banner').getByRole('button', { name: label });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  const backtest = page.getByRole('button', {
    name: locale === 'fr' ? /Journal de backtest/i : /Backtest journal/i,
  });
  // Clic unique pour ouvrir (évite le toggle hover+click).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await backtest.isVisible().catch(() => false)) break;
    await trigger.click();
    await page.waitForTimeout(300);
  }
  await expect(backtest).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Market Replay/i })).toBeVisible();
}

type QuestionsSection = 'templates' | 'day' | 'position';

async function openQuestionsSettings(page: Page, locale: LocaleCode, section: QuestionsSection) {
  await goHash(page, '#settings');
  await dismissOverlays(page);
  // Sidebar Settings : libellé `settings:questionnaire` (FR/EN « Questionnaire »)
  const settingsNav = appMain(page).getByRole('navigation').first();
  const questionsTab = settingsNav.getByRole('button', { name: /^Questionnaire$/i });
  await expect(questionsTab).toBeVisible({ timeout: 30_000 });
  await questionsTab.click();

  const sectionLabel =
    section === 'templates'
      ? locale === 'fr'
        ? /Modèles de questions/i
        : /Question templates/i
      : section === 'day'
        ? locale === 'fr'
          ? /Questionnaire du jour/i
          : /Daily questionnaire/i
        : locale === 'fr'
          ? /Questionnaire positions/i
          : /Position questionnaire/i;

  const sectionBtn = appMain(page).getByRole('button', { name: sectionLabel });
  await expect(sectionBtn).toBeVisible({ timeout: 30_000 });
  await sectionBtn.click();
  await page.waitForTimeout(300);
}

async function selectAccountByName(page: Page, nameRe: RegExp) {
  // Le sélecteur de compte n’existe pas sur toutes les pages (ex. Settings).
  const trigger = appMain(page)
    .getByRole('button')
    .filter({ hasText: /Demo Futures|Demo TopStep|Tous les comptes|All accounts/i })
    .first();
  if (!(await trigger.isVisible().catch(() => false))) {
    return;
  }
  if (nameRe.test(await trigger.innerText())) {
    return;
  }
  await trigger.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible({ timeout: 15_000 });
  const option = listbox.getByRole('button', { name: nameRe }).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
  await expect(listbox).toBeHidden({ timeout: 10_000 });
  await expect(trigger).toContainText(nameRe, { timeout: 15_000 });
}

async function selectDemoTopStepAccount(page: Page) {
  await selectAccountByName(page, /Demo TopStep Account/i);
}

async function setApiKeyEditMode(page: Page, locale: LocaleCode, editing: boolean) {
  const root = appMain(page);
  const changeLabel = locale === 'fr' ? /^Modifier$/i : /^Change$/i;
  const cancelLabel = locale === 'fr' ? /Annuler la modification/i : /Cancel edit/i;
  const placeholder = root.getByPlaceholder(
    locale === 'fr' ? /Collez votre clé API/i : /Paste your API key/i
  );
  const isEditing = await placeholder.isVisible().catch(() => false);

  if (editing && !isEditing) {
    const changeBtn = root.getByRole('button', { name: changeLabel }).first();
    await expect(changeBtn).toBeVisible({ timeout: 15_000 });
    await changeBtn.click();
    await expect(placeholder).toBeVisible({ timeout: 10_000 });
  } else if (!editing && isEditing) {
    const cancelBtn = root.getByRole('button', { name: cancelLabel }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();
    await expect(placeholder).toBeHidden({ timeout: 10_000 });
  }
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
  await closeStrategyModals(page);
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
  test('capture tutorials FR+EN (incl. transactions-profitability)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Captures Chromium only');

    await login(page);

    const digestsByLocale: Record<string, string[]> = {};

    for (const locale of LOCALES) {
      await setUiLanguage(page, locale);
      // Compte défaut seed = TopStep (trades + Sync). Réaffirmer après bascule langue.
      await goHash(page, '#trades');
      await dismissOverlays(page);
      await selectDemoTopStepAccount(page);

      const localeDir = path.join(outRoot, locale.code);
      fs.mkdirSync(localeDir, { recursive: true });
      digestsByLocale[locale.code] = [];

      const stepsToCapture = ONLY_SLUG
        ? STEPS.filter((s) => s.slug === ONLY_SLUG)
        : STEPS;
      if (ONLY_SLUG && stepsToCapture.length === 0) {
        throw new Error(`TUTORIAL_ONLY_SLUG inconnu: ${ONLY_SLUG}`);
      }

      for (const step of stepsToCapture) {
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
      await closeStrategyModals(page);
    }

    const frJoined = digestsByLocale.fr.join('|');
    const enJoined = digestsByLocale.en.join('|');
    expect(frJoined).not.toEqual(enJoined);

    await setUiLanguage(page, LOCALES[0]);
    await goHash(page, '#help');
    await expect(page.getByTestId('help-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('help-card-api-connections')).toBeVisible();
    await expect(page.getByTestId('help-card-journal-questions')).toBeVisible();
    await expect(page.getByTestId('help-card-transactions-profitability')).toBeVisible();
    await expect(page.getByTestId('help-card-backtest-market-replay')).toBeVisible();
    await expect(page.getByTestId('help-card-position-strategies')).toBeVisible();
    await page.getByTestId('help-card-position-strategies').click();
    await expect(page.getByTestId('tutorial-viewer-position-strategies')).toBeVisible();
  });
});
