import { test, expect, type Page } from '@playwright/test';

const MARKET_QUOTES_SNAPSHOT = {
  updated_at: '2026-10-27T12:00:00Z',
  connected: true,
  message: null,
  quotes: [
    {
      key: 'nasdaq',
      label: 'Nasdaq',
      contract_id: 'CON.F.US.ENQ',
      last_price: 29801.75,
      last_price_display: '29801.75',
      change: 365.0,
      change_percent: 1.24,
      timestamp: '2026-10-27T12:00:00Z',
    },
    {
      key: 'sp500',
      label: 'S&P 500',
      contract_id: 'CON.F.US.EP',
      last_price: 7752.5,
      last_price_display: '7752.50',
      change: 38.0,
      change_percent: 0.49,
      timestamp: '2026-10-27T12:00:00Z',
    },
    {
      key: 'gold',
      label: 'Or',
      contract_id: 'CON.F.US.MGC',
      last_price: 4075.0,
      last_price_display: '4075.00',
      change: 36.8,
      change_percent: 0.91,
      timestamp: '2026-10-27T12:00:00Z',
    },
    {
      key: 'eurusd',
      label: 'EUR/USD',
      contract_id: 'CON.F.US.M6E',
      last_price: 1.0842,
      last_price_display: '1.0842',
      change: 0.0012,
      change_percent: 0.11,
      timestamp: '2026-10-27T12:00:00Z',
    },
    {
      key: 'bitcoin',
      label: 'Bitcoin',
      contract_id: 'CON.F.US.MBT',
      last_price: 67850.0,
      last_price_display: '67850.00',
      change: 420.0,
      change_percent: 0.62,
      timestamp: '2026-10-27T12:00:00Z',
    },
  ],
};

const TOPSTEP_INTEGRATION = {
  provider: 'topstepx',
  display_name: 'TopStepX',
  configured: true,
  external_username: 'e2e',
  secrets_hint: {},
  is_connected: true,
  last_validated_at: null,
  required_secret_fields: [],
  public_fields: [],
};

async function mockMarketQuotesApis(page: Page) {
  await page.route('**/api/accounts/integrations/', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ integrations: [TOPSTEP_INTEGRATION] }),
    });
  });

  await page.route('**/api/trades/market-quotes/', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MARKET_QUOTES_SNAPSHOT),
    });
  });

  await page.routeWebSocket('**/ws/market-quotes/**', (ws) => {
    ws.send(JSON.stringify(MARKET_QUOTES_SNAPSHOT));
  });
}

function boxFullyInside(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
  slack = 1,
) {
  return (
    inner.x >= outer.x - slack &&
    inner.x + inner.width <= outer.x + outer.width + slack &&
    inner.y >= outer.y - slack &&
    inner.y + inner.height <= outer.y + outer.height + slack
  );
}

test.describe('bandeau cotations mobile', () => {
  test('libellés visibles sans clip à gauche (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockMarketQuotesApis(page);

    await page.goto('/#dashboard');
    await expect(page).toHaveURL(/#dashboard/);

    const region = page.getByRole('region', { name: /Cours marché en direct/i });
    await expect(region).toBeVisible({ timeout: 30_000 });

    const shell = region.locator(':scope > div').first();
    await expect(shell).toBeVisible();

    const nasdaq = region.getByText('Nasdaq', { exact: true });
    const sp500 = region.getByText('S&P 500', { exact: true });
    const gold = region.getByText('Or', { exact: true });
    const live = region.getByText(/EN DIRECT|HORS LIGNE/i);

    await expect(nasdaq).toBeVisible();
    await expect(sp500).toBeVisible();
    await expect(gold).toBeVisible();
    await expect(live).toBeVisible();

    const scrollLeft = await shell.evaluate((el) => el.scrollLeft);
    expect(scrollLeft, 'le bandeau doit démarrer à scrollLeft=0').toBe(0);

    const shellBox = await shell.boundingBox();
    const nasdaqBox = await nasdaq.boundingBox();
    const liveBox = await live.boundingBox();
    expect(shellBox, 'bounding box shell').toBeTruthy();
    expect(nasdaqBox, 'bounding box Nasdaq').toBeTruthy();
    expect(liveBox, 'bounding box Live').toBeTruthy();

    expect(
      boxFullyInside(liveBox!, shellBox!),
      'badge Live clipé hors du shell',
    ).toBe(true);
    expect(
      boxFullyInside(nasdaqBox!, shellBox!),
      'libellé Nasdaq clipé hors du shell',
    ).toBe(true);
  });
});
