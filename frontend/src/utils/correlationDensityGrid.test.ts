import {
  buildTradeSlots,
  computeDayTotalsByTrades,
  computeMaxCountByTrades,
  computeNiceYBounds,
  computeTradePnlDensityGrid,
  computeXTickValues,
  densityIntensity,
} from './correlationDensityGrid';

describe('correlationDensityGrid', () => {
  const domain = { yMin: -2000, yMax: 2000, minTrades: 1, maxTrades: 8 };

  it('répartit les colonnes selon le nombre de trades', () => {
    const cells = computeTradePnlDensityGrid(
      [
        { x: 1, y: 100 },
        { x: 2, y: 200 },
        { x: 2, y: 210 },
        { x: 5, y: -500 },
      ],
      domain,
      20,
    );
    const tradeCounts = new Set(cells.map((c) => c.trades));
    expect(tradeCounts.has(1)).toBe(true);
    expect(tradeCounts.has(2)).toBe(true);
    expect(tradeCounts.has(5)).toBe(true);
  });

  it('agrège les jours proches en PnL dans la même bande', () => {
    const cells = computeTradePnlDensityGrid(
      [
        { x: 3, y: 1000 },
        { x: 3, y: 1005 },
      ],
      domain,
      30,
    );
    const merged = cells.find((c) => c.trades === 3 && c.count === 2);
    expect(merged).toBeDefined();
    expect(merged?.avgPnl).toBeCloseTo(1002.5, 0);
  });

  it('normalise la densité par colonne', () => {
    const cells = computeTradePnlDensityGrid(
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 10 },
        { x: 2, y: 20 },
      ],
      domain,
      10,
    );
    const maxByTrades = computeMaxCountByTrades(cells);
    expect(maxByTrades.get(1)).toBe(1);
    expect(maxByTrades.get(2)).toBeGreaterThanOrEqual(1);
    expect(densityIntensity(1, 1)).toBe(1);
    expect(densityIntensity(1, maxByTrades.get(2) ?? 1)).toBeGreaterThan(0.35);
  });

  it('compte les jours par nombre de trades', () => {
    const totals = computeDayTotalsByTrades([
      { x: 1, y: 100 },
      { x: 2, y: 200 },
      { x: 2, y: -50 },
    ]);
    expect(totals.get(1)).toBe(1);
    expect(totals.get(2)).toBe(2);
  });

  it('buildTradeSlots génère une bande par entier', () => {
    expect(buildTradeSlots(1, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('computeNiceYBounds et computeXTickValues', () => {
    const { yMin, yMax } = computeNiceYBounds([-2100, 1800]);
    expect(yMin).toBeLessThan(-2100);
    expect(yMax).toBeGreaterThan(1800);
    expect(computeXTickValues(1, 8)).toContain(1);
    expect(computeXTickValues(1, 8)).toContain(8);
  });
});
