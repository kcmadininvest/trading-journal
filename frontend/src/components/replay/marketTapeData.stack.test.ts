import { applyMarkerVerticalStackOffsets, TapeMarker } from './marketTapeData';
import { computeTapeExitMarkerLayout } from './marketTapeMarkerLayout';
import { getMarketTapeTheme } from './replayStyles';
import type { TapeRenderModel } from './marketTapeData';

function exitMarker(overrides: Partial<TapeMarker>): TapeMarker {
  return {
    kind: 'exit',
    barIndex: 0,
    price: 100,
    occurredAt: '2024-01-01T10:00:00Z',
    ...overrides,
  };
}

describe('applyMarkerVerticalStackOffsets', () => {
  it('empile les sorties chronologiquement sur la même bougie', () => {
    const markers: TapeMarker[] = [
      exitMarker({ price: 105, pnl: 755, occurredAt: '2024-01-01T10:02:00Z' }),
      exitMarker({ price: 102, pnl: 990, occurredAt: '2024-01-01T10:04:00Z' }),
    ];
    const stacked = applyMarkerVerticalStackOffsets(markers);

    expect(stacked[0].stackSlot).toBe(0);
    expect(stacked[0].stackAnchorPrice).toBe(105);
    expect(stacked[1].stackSlot).toBe(1);
    expect(stacked[1].stackAnchorPrice).toBe(105);
  });

  it('does not offset an exit stacked against an entry on the same bar', () => {
    const markers: TapeMarker[] = [
      {
        kind: 'entry',
        barIndex: 0,
        price: 30532.5,
        occurredAt: '2026-06-01T16:50:55.765049Z',
        side: 'Long',
      },
      exitMarker({ price: 30570.25, pnl: 755, occurredAt: '2026-06-01T16:53:14.802469Z' }),
    ];
    const stacked = applyMarkerVerticalStackOffsets(markers);
    expect(stacked[1].offsetY).toBeUndefined();
    expect(stacked[1].stackSlot).toBeUndefined();
  });

  it('place la pastille de sortie la plus récente au-dessus de la plus ancienne', () => {
    const model: TapeRenderModel = {
      contractId: 'c1',
      label: 'NQ',
      bars: [{ index: 0, t: '2024-01-01T10:00:00Z', o: 100, h: 110, l: 95, c: 105, isFuture: false }],
      markers: [],
      priceLines: [],
      cursorBarIndex: 0,
      yMin: 90,
      yMax: 115,
      cursorTime: null,
      openPositionBand: null,
    };
    const theme = getMarketTapeTheme(true);
    const markers = applyMarkerVerticalStackOffsets([
      exitMarker({ price: 105, pnl: 755, occurredAt: '2024-01-01T10:02:00Z' }),
      exitMarker({ price: 102, pnl: 990, occurredAt: '2024-01-01T10:04:00Z' }),
    ]);

    const first = computeTapeExitMarkerLayout(markers[0], model, 1, theme)!;
    const second = computeTapeExitMarkerLayout(markers[1], model, 1, theme)!;

    expect(first.dotY).toBeGreaterThan(second.dotY);
    expect(first.tickY).not.toBe(second.tickY);
  });
});
