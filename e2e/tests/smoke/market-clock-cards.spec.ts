import { test, expect, type Page } from '@playwright/test';

/** Samedi 2026-10-24 12:00 Europe/Paris (veille du fall EU 2026-10-25). */
const FROZEN_MS = Date.parse('2026-10-24T10:00:00.000Z');

const HOLIDAYS_BUNDLE = {
  markets: {
    XNYS: {
      date: '2026-10-24',
      is_full_day_holiday: false,
      is_early_close_day: false,
      regular_session_close_local: null,
    },
    XPAR: {
      date: '2026-10-24',
      is_full_day_holiday: false,
      is_early_close_day: false,
      regular_session_close_local: null,
    },
    XLON: {
      date: '2026-10-24',
      is_full_day_holiday: false,
      is_early_close_day: false,
      regular_session_close_local: null,
    },
    XTKS: {
      date: '2026-10-24',
      is_full_day_holiday: false,
      is_early_close_day: false,
      regular_session_close_local: null,
    },
  },
  upcoming: [
    {
      date: '2026-10-25',
      name: 'Euronext Paris Early Close',
      type: 'early_close',
      market: 'XPAR',
    },
    {
      date: '2026-10-25',
      name: 'LSE Early Close',
      type: 'early_close',
      market: 'XLON',
    },
  ],
  count: 2,
};

async function mockMarketHolidays(page: Page) {
  await page.route('**/api/trades/market-holidays/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(HOLIDAYS_BUNDLE),
    });
  });
}

test.describe('cartes horaires marchés (DST + early close)', () => {
  test('Fermeture anticipée localisée et badge Hiver demain', async ({ page }) => {
    await page.addInitScript((frozenMs: number) => {
      const RealDate = Date;
      function FrozenDate(this: Date, ...args: unknown[]) {
        if (args.length === 0) {
          return new RealDate(frozenMs);
        }
        return new (RealDate as DateConstructor)(...(args as []));
      }
      FrozenDate.prototype = RealDate.prototype;
      FrozenDate.now = () => frozenMs;
      FrozenDate.parse = RealDate.parse;
      FrozenDate.UTC = RealDate.UTC;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).Date = FrozenDate;
    }, FROZEN_MS);

    await mockMarketHolidays(page);
    await page.goto('/#dashboard');
    await expect(page).toHaveURL(/#dashboard/);

    const region = page.getByRole('region', { name: /Marchés/i });
    await expect(region).toBeVisible({ timeout: 30_000 });

    const euronext = page.getByTestId('market-clock-XPAR');
    await expect(euronext).toBeVisible();
    await expect(euronext.getByText('Fermeture anticipée')).toBeVisible();
    await expect(euronext.getByText('Early Close')).toHaveCount(0);
    await expect(euronext.getByText('Hiver demain')).toBeVisible();
    await expect(euronext.getByText('Demain', { exact: true })).toBeVisible();

    const lse = page.getByTestId('market-clock-XLON');
    await expect(lse.getByText('Hiver demain')).toBeVisible();
  });
});
