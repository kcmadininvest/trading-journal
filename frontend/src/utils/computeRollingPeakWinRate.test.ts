import {
  buildTradeOutcomeSeries,
  computeRollingPeakWinRate,
  computeTrailingWinRate,
  getTradePnlOutcome,
  orderTradesChronologically,
  resolveWinRateRingSecondary,
  usesRecentWinRateRing,
} from './computeRollingPeakWinRate';
import type { TradeForWinRate } from './computeRollingPeakWinRate';

function trade(
  id: string,
  entered_at: string,
  net_pnl: string,
  pnl?: string,
): TradeForWinRate {
  return { entered_at, net_pnl, pnl };
}

describe('getTradePnlOutcome', () => {
  it('utilise le P/L brut en mode gross', () => {
    const row = trade('g', '2025-01-01T10:00:00Z', '0', '50');
    expect(getTradePnlOutcome(row, 'gross')).toBe('win');
    expect(getTradePnlOutcome(row, 'net')).toBe('breakeven');
  });

  it('classe le breakeven sans le compter comme victoire', () => {
    const row = trade('be', '2025-01-01T10:00:00Z', '0');
    expect(getTradePnlOutcome(row, 'net')).toBe('breakeven');
  });
});

describe('orderTradesChronologically', () => {
  it('trie par entered_at', () => {
    const rows = [
      trade('b', '2025-01-03T10:00:00Z', '10'),
      trade('a', '2025-01-01T10:00:00Z', '-5'),
      trade('c', '2025-01-02T10:00:00Z', '0'),
    ];
    expect(orderTradesChronologically(rows).map((r) => r.net_pnl)).toEqual(['-5', '0', '10']);
  });
});

describe('computeRollingPeakWinRate', () => {
  it('retourne null si moins de trades que la fenêtre', () => {
    const rows = Array.from({ length: 19 }, (_, i) =>
      trade(String(i), `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, '10'),
    );
    expect(computeRollingPeakWinRate(rows, 'net', 20)).toBeNull();
  });

  it('retourne 100 % pour 20 victoires consécutives', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      trade(String(i), `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, '10'),
    );
    expect(computeRollingPeakWinRate(rows, 'net', 20)).toBe(100);
  });

  it('prend le maximum sur toutes les fenêtres glissantes', () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) =>
        trade(`w${i}`, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, '10'),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        trade(`l${i}`, `2025-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`, '-5'),
      ),
    ];
    expect(computeRollingPeakWinRate(rows, 'net', 20)).toBe(100);
  });

  it('détecte un pic partiel au milieu de la série', () => {
    const outcomes = ['10', '-5', '10', '10', '10', '10', '-5', '-5', '-5', '-5'];
    const rows = outcomes.map((net_pnl, i) =>
      trade(String(i), `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, net_pnl),
    );
    expect(computeRollingPeakWinRate(rows, 'net', 5)).toBe(80);
  });

  it('compte le breakeven dans la fenêtre sans le traiter comme victoire', () => {
    const rows = [
      trade('1', '2025-01-01T10:00:00Z', '10'),
      trade('2', '2025-01-02T10:00:00Z', '0'),
      trade('3', '2025-01-03T10:00:00Z', '10'),
      trade('4', '2025-01-04T10:00:00Z', '10'),
    ];
    expect(computeRollingPeakWinRate(rows, 'net', 4)).toBe(75);
  });

  it('respecte l ordre chronologique et non l ordre du tableau', () => {
    const rows = [
      trade('late', '2025-01-03T10:00:00Z', '10'),
      trade('early', '2025-01-01T10:00:00Z', '10'),
      trade('mid', '2025-01-02T10:00:00Z', '-5'),
    ];
    expect(computeRollingPeakWinRate(rows, 'net', 3)).toBeCloseTo(66.666, 2);
  });
});

describe('computeTrailingWinRate', () => {
  it('retourne le win rate des N derniers trades seulement', () => {
    const rows = [
      ...Array.from({ length: 18 }, (_, i) =>
        trade(`w${i}`, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, '10'),
      ),
      trade('l1', '2025-01-19T10:00:00Z', '-5'),
      trade('l2', '2025-01-20T10:00:00Z', '-5'),
    ];
    expect(computeTrailingWinRate(rows, 'net', 20)).toBe(90);
  });

  it('retourne null si moins de trades que la fenêtre', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      trade(String(i), `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, '10'),
    );
    expect(computeTrailingWinRate(rows, 'net', 20)).toBeNull();
  });
});

describe('resolveWinRateRingSecondary', () => {
  const rows = [
    ...Array.from({ length: 20 }, (_, i) =>
      trade(`w${i}`, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, '10'),
    ),
    trade('l1', '2025-02-01T10:00:00Z', '-5'),
    trade('l2', '2025-02-02T10:00:00Z', '-5'),
  ];

  it.each([
    'allTime',
    'thisYear',
    'lastMonth',
    'last3Months',
    'last6Months',
    'rollingYear',
    'custom',
  ] as const)('utilise les 20 derniers trades pour %s', (preset) => {
    const resolved = resolveWinRateRingSecondary(rows, 'net', preset);
    expect(resolved.mode).toBe('recent');
    expect(resolved.value).toBe(90);
  });
});

describe('usesRecentWinRateRing', () => {
  it('retourne toujours true', () => {
    expect(usesRecentWinRateRing('allTime')).toBe(true);
    expect(usesRecentWinRateRing('last3Months')).toBe(true);
    expect(usesRecentWinRateRing('rollingYear')).toBe(true);
  });
});

describe('buildTradeOutcomeSeries', () => {
  it('retourne la série chronologique W/L/B', () => {
    const rows = [
      trade('b', '2025-01-03T10:00:00Z', '10'),
      trade('a', '2025-01-01T10:00:00Z', '-5'),
      trade('c', '2025-01-02T10:00:00Z', '0'),
    ];
    expect(buildTradeOutcomeSeries(rows, 'net').map((item) => item.letter)).toEqual(['L', 'B', 'W']);
  });

  it('respecte le mode brut vs net', () => {
    const row = trade('g', '2025-01-01T10:00:00Z', '0', '50');
    expect(buildTradeOutcomeSeries([row], 'gross').map((item) => item.letter)).toEqual(['W']);
    expect(buildTradeOutcomeSeries([row], 'net').map((item) => item.letter)).toEqual(['B']);
  });

  it('limite aux N derniers trades en mode tail', () => {
    const rows = [
      trade('1', '2025-01-01T10:00:00Z', '10'),
      trade('2', '2025-01-02T10:00:00Z', '-5'),
      trade('3', '2025-01-03T10:00:00Z', '10'),
      trade('4', '2025-01-04T10:00:00Z', '-5'),
    ];
    expect(
      buildTradeOutcomeSeries(rows, 'net', { limit: 2, tail: true }).map((item) => item.letter),
    ).toEqual(['W', 'L']);
  });

  it('retourne toute la série sans limite', () => {
    const rows = [
      trade('1', '2025-01-01T10:00:00Z', '10'),
      trade('2', '2025-01-02T10:00:00Z', '-5'),
    ];
    expect(buildTradeOutcomeSeries(rows, 'net').map((item) => item.letter)).toEqual(['W', 'L']);
  });
});
