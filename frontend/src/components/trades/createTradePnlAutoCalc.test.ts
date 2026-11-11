import { describe, expect, it } from 'vitest';
import {
  computeGrossPnl,
  isSameNumericInput,
  shouldAutoCalculatePnl,
} from './createTradePnlAutoCalc';

describe('shouldAutoCalculatePnl', () => {
  it('bloque si PnL édité manuellement', () => {
    expect(
      shouldAutoCalculatePnl({
        isPnlManuallyEdited: true,
        isEditMode: false,
        priceFieldsDirtySinceHydrate: true,
      }),
    ).toBe(false);
  });

  it('en édition sans dirty prix : pas de recalc (préserve pnl API après hard refresh)', () => {
    expect(
      shouldAutoCalculatePnl({
        isPnlManuallyEdited: false,
        isEditMode: true,
        priceFieldsDirtySinceHydrate: false,
      }),
    ).toBe(false);
  });

  it('en édition après dirty prix : recalc autorisé', () => {
    expect(
      shouldAutoCalculatePnl({
        isPnlManuallyEdited: false,
        isEditMode: true,
        priceFieldsDirtySinceHydrate: true,
      }),
    ).toBe(true);
  });

  it('en création : recalc dès que non manuel', () => {
    expect(
      shouldAutoCalculatePnl({
        isPnlManuallyEdited: false,
        isEditMode: false,
        priceFieldsDirtySinceHydrate: false,
      }),
    ).toBe(true);
  });
});

describe('computeGrossPnl', () => {
  it('Long MNQ-like : 8.25 × 5 × 2 = 82.5', () => {
    expect(
      computeGrossPnl({
        tradeType: 'Long',
        entryPrice: 27939.25,
        exitPrice: 27947.5,
        size: 5,
        pointValue: 2,
      }),
    ).toBe(82.5);
  });

  it('Long broker 370 : 37 × 5 × 2 = 370', () => {
    expect(
      computeGrossPnl({
        tradeType: 'Long',
        entryPrice: 27910.5,
        exitPrice: 27947.5,
        size: 5,
        pointValue: 2,
      }),
    ).toBe(370);
  });
});

describe('isSameNumericInput', () => {
  it('traite 27939.2500 et 27939.25 comme identiques', () => {
    expect(isSameNumericInput('27939.2500', '27939.25')).toBe(true);
  });

  it('détecte un vrai changement de prix', () => {
    expect(isSameNumericInput('27939.25', '27910.5')).toBe(false);
  });
});
