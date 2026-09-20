import { describe, expect, it } from 'vitest';
import {
  adjustStopForLockedRR,
  adjustTargetForLockedRR,
  calculatePositionSizeFromRisk,
  computePositionMetrics,
  flipPositionSide,
  getBaseSymbol,
  resolveContractSpecs,
  riskRewardRatio,
  translateLevels,
} from './positionToolMetrics';

describe('positionToolMetrics', () => {
  it('resolves NQ / MNQ base symbols', () => {
    expect(getBaseSymbol('NQH25')).toBe('NQ');
    expect(getBaseSymbol('MNQ')).toBe('MNQ');
    expect(getBaseSymbol('CON.F.US.ENQ.H25')).toBe('NQ');
    expect(resolveContractSpecs('NQ')).toMatchObject({
      pointValue: 20,
      tickSize: 0.25,
    });
    expect(resolveContractSpecs('MNQ')?.pointValue).toBe(2);
  });

  it('computes R:R for long and short', () => {
    expect(
      riskRewardRatio({
        entryPrice: 100,
        stopPrice: 90,
        targetPrice: 120,
        side: 'long',
      }),
    ).toBe(2);
    expect(
      riskRewardRatio({
        entryPrice: 100,
        stopPrice: 110,
        targetPrice: 85,
        side: 'short',
      }),
    ).toBe(1.5);
  });

  it('computes P&L $ with point value', () => {
    const metrics = computePositionMetrics(
      {
        entryPrice: 20_000,
        stopPrice: 19_990,
        targetPrice: 20_015,
        side: 'long',
      },
      2,
      { pointValue: 20, tickSize: 0.25 },
    );
    // stop: -10 pts × 20 × 2 = -400
    expect(metrics.stopPnl).toBe(-400);
    // target: +15 × 20 × 2 = 600
    expect(metrics.targetPnl).toBe(600);
    expect(metrics.riskReward).toBe(1.5);
  });

  it('position size from risk % matches formula §4', () => {
    // NQ: point_value 20, stop 10 pts → risk/contract = 200
    // balance 50k, risk 1% = 500 → floor(500/200) = 2
    const qty = calculatePositionSizeFromRisk({
      accountBalance: 50_000,
      riskPercentage: 1,
      entryPrice: 20_000,
      stopLossPrice: 19_990,
      pointValue: 20,
      tickSize: 0.25,
    });
    expect(qty).toBe(2);
  });

  it('flips long to short by mirroring SL/TP', () => {
    const flipped = flipPositionSide({
      entryPrice: 100,
      stopPrice: 90,
      targetPrice: 120,
      side: 'long',
    });
    expect(flipped.side).toBe('short');
    expect(flipped.stopPrice).toBe(110);
    expect(flipped.targetPrice).toBe(80);
  });

  it('locked RR adjusts target from stop', () => {
    expect(adjustTargetForLockedRR(100, 90, 'long', 2)).toBe(120);
    expect(adjustTargetForLockedRR(100, 110, 'short', 1.5)).toBe(85);
  });

  it('locked RR adjusts stop from target', () => {
    expect(adjustStopForLockedRR(100, 120, 'long', 2)).toBe(90);
    expect(adjustStopForLockedRR(100, 85, 'short', 1.5)).toBe(110);
  });

  it('translateLevels keeps distances', () => {
    const next = translateLevels(
      { entryPrice: 100, stopPrice: 90, targetPrice: 120, side: 'long' },
      5,
    );
    expect(next).toEqual({
      entryPrice: 105,
      stopPrice: 95,
      targetPrice: 125,
      side: 'long',
    });
  });
});
