import { describe, expect, it } from 'vitest';
import { computeTradeOutcomePartition } from './tradeOutcomePartition';

describe('computeTradeOutcomePartition', () => {
  it('retire les BE soft des gagnants pour éviter le double comptage', () => {
    const result = computeTradeOutcomePartition({
      totalTrades: 100,
      winningTrades: 60,
      losingTrades: 30,
      breakEvenTrades: 20, // 10 zero + 10 soft
      breakEvenPositiveTrades: 10,
    });

    expect(result.winners).toBe(50);
    expect(result.losers).toBe(30);
    expect(result.breakEven).toBe(20);
    expect(result.total).toBe(100);
    expect(result.winnersPct).toBeCloseTo(50, 5);
    expect(result.losersPct).toBeCloseTo(30, 5);
    expect(result.breakEvenPct).toBeCloseTo(20, 5);
    expect(result.softBeShareOfActivityPct).toBeCloseTo(10, 5);
    expect(result.softBeShareOfPositivePct).toBeCloseTo((10 / 60) * 100, 5);
    expect(result.isEmpty).toBe(false);
  });

  it('retourne vide quand il n’y a aucun trade', () => {
    const result = computeTradeOutcomePartition({
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      breakEvenPositiveTrades: 0,
    });

    expect(result.isEmpty).toBe(true);
    expect(result.winnersPct).toBe(0);
    expect(result.softBeShareOfActivityPct).toBe(0);
  });

  it('ne produit pas de gagnants négatifs si soft BE > winning', () => {
    const result = computeTradeOutcomePartition({
      totalTrades: 5,
      winningTrades: 2,
      losingTrades: 1,
      breakEvenTrades: 4,
      breakEvenPositiveTrades: 5,
    });

    expect(result.winners).toBe(0);
    expect(result.softBeCount).toBe(5);
  });
});
