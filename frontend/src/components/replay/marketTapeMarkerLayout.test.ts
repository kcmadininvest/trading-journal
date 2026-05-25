import { computeTapeExitMarkerLayout } from './marketTapeMarkerLayout';
import { tapeYForPrice } from './marketTapeChartMetrics';
import type { TapeMarker, TapeRenderModel } from './marketTapeData';
import { getMarketTapeTheme } from './replayStyles';

function baseModel(overrides: Partial<TapeRenderModel> = {}): TapeRenderModel {
  return {
    contractId: 'c1',
    label: 'TEST',
    bars: [
      { index: 0, t: '2024-01-01T10:00:00Z', o: 100, h: 110, l: 95, c: 105, isFuture: false },
      { index: 1, t: '2024-01-01T10:05:00Z', o: 105, h: 108, l: 102, c: 103, isFuture: false },
    ],
    markers: [],
    priceLines: [],
    cursorBarIndex: 1,
    yMin: 90,
    yMax: 115,
    cursorTime: null,
    openPositionBand: null,
    ...overrides,
  };
}

function exitMarker(overrides: Partial<TapeMarker> = {}): TapeMarker {
  return {
    kind: 'exit',
    barIndex: 0,
    price: 110,
    occurredAt: '2024-01-01T10:02:00Z',
    pnl: 50,
    ...overrides,
  };
}

describe('computeTapeExitMarkerLayout', () => {
  const theme = getMarketTapeTheme(true);

  it('aligns priceY with exit_price on wick high', () => {
    const model = baseModel();
    const marker = exitMarker({ price: 110 });
    const layout = computeTapeExitMarkerLayout(marker, model, 2, theme);
    expect(layout).not.toBeNull();
    expect(layout!.priceY).toBe(tapeYForPrice(110, model.yMin, model.yMax));
    expect(layout!.dotY).toBe(layout!.priceY);
  });

  it('aligns priceY with exit_price on wick low', () => {
    const model = baseModel();
    const marker = exitMarker({ price: 95, pnl: -10 });
    const layout = computeTapeExitMarkerLayout(marker, model, 2, theme);
    expect(layout!.priceY).toBe(tapeYForPrice(95, model.yMin, model.yMax));
    expect(layout!.fill).toBe(theme.exitLoss);
  });

  it('flips dot to the right when left placement is out of bounds', () => {
    const model = baseModel();
    const marker = exitMarker({ barIndex: 0 });
    const layout = computeTapeExitMarkerLayout(marker, model, 20, theme);
    expect(layout!.dotX).toBeGreaterThan(layout!.barX);
  });

  it('places dot fully left of candle body', () => {
    const model = baseModel();
    const marker = exitMarker({ barIndex: 1 });
    const layout = computeTapeExitMarkerLayout(marker, model, 2, theme);
    const halfW = 7 * 0.72 / 2;
    expect(layout!.dotX + 4.5).toBeLessThanOrEqual(layout!.barX - halfW - 1);
  });

  it('applies stack offsetY to priceY and dotY', () => {
    const model = baseModel();
    const marker = exitMarker({ offsetY: -22 });
    const layout = computeTapeExitMarkerLayout(marker, model, 2, theme);
    const baseY = tapeYForPrice(110, model.yMin, model.yMax);
    expect(layout!.priceY).toBe(baseY - 22);
    expect(layout!.dotY).toBe(baseY - 22);
  });

  it('applies stack offsetX further left', () => {
    const model = baseModel();
    const base = computeTapeExitMarkerLayout(exitMarker({ barIndex: 1 }), model, 2, theme)!;
    const stacked = computeTapeExitMarkerLayout(
      exitMarker({ barIndex: 1, offsetX: -22 }),
      model,
      2,
      theme,
    )!;
    expect(stacked.dotX).toBeLessThan(base.dotX);
  });
});
