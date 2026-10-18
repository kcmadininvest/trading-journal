import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { apiContext, findBuiltSession, login } from '../../helpers/api';

test('relève la géométrie SVG du ruban cran par cran', async ({ page }) => {
  const api = await apiContext();
  await login(api);
  const sessionDate = process.env.E2E_SESSION_DATE;
  const session = await findBuiltSession(api, sessionDate);
  await api.dispose();
  test.skip(!session, 'Aucune session construite sur le compte de test.');

  const steps = Math.max(session!.event_count ?? 1, 1);
  test.setTimeout(steps * 1500 + 60_000);

  await page.goto(
    `/#session-replay?account=${session!.trading_account}&date=${session!.session_date}`,
  );
  const cursor = page.getByTestId('session-replay-cursor');
  const counter = page.getByTestId('session-replay-counter');
  await expect(cursor).toBeEnabled({ timeout: 30_000 });
  const tape = page.getByTestId('session-market-tape');
  await expect(tape).toBeVisible();

  const max = Number(await cursor.getAttribute('max'));
  const last = Number.isFinite(max) ? max : 0;
  const shotDir = '/tmp/tape-2026-10-12';
  mkdirSync(shotDir, { recursive: true });

  for (let index = 0; index <= last; index += 1) {
    await cursor.evaluate((element, value) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, index);
    await expect(counter).toHaveText(new RegExp(`^${index + 1} /`));
    const rects = await tape.locator('rect').evaluateAll((nodes) =>
      nodes.map((node) => ({
        x: node.getAttribute('x'),
        y: node.getAttribute('y'),
        width: node.getAttribute('width'),
        height: node.getAttribute('height'),
      })),
    );
    await test.info().attach(`geometry-${index}.json`, {
      body: JSON.stringify(rects),
      contentType: 'application/json',
    });
    const shot = await tape.screenshot();
    if (index % 10 === 0 || index === last) {
      writeFileSync(`${shotDir}/${String(index).padStart(3, '0')}.png`, shot);
    }
    await test.info().attach(`tape-${index}.png`, {
      body: shot,
      contentType: 'image/png',
    });
  }
});
