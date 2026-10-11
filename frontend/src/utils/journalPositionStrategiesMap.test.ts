import { describe, expect, it } from 'vitest';
import {
  resolveVisibleStrategyId,
  type StrategyFamilyRef,
} from './journalPositionStrategiesMap';

function strategy(
  id: number,
  parent: number | null,
  version: number,
  isCurrent = false,
): StrategyFamilyRef {
  return {
    id,
    parent_strategy: parent,
    version,
    is_current: isCurrent,
  };
}

describe('resolveVisibleStrategyId', () => {
  const visible = [
    strategy(12, 10, 3, true),
    strategy(20, null, 1, true),
  ];

  it('garde null', () => {
    expect(resolveVisibleStrategyId(null, visible)).toBeNull();
  });

  it('garde un identifiant déjà visible', () => {
    expect(resolveVisibleStrategyId(20, visible, strategy(11, 10, 2))).toBe(20);
  });

  it('retrouve la version courante depuis une version intermédiaire archivée', () => {
    expect(resolveVisibleStrategyId(11, visible, strategy(11, 10, 2))).toBe(12);
  });

  it('retrouve la version courante depuis la racine archivée', () => {
    expect(resolveVisibleStrategyId(10, visible, strategy(10, null, 1))).toBe(12);
  });

  it('choisit la version courante au numéro le plus élevé', () => {
    const bothCurrent = [
      strategy(12, 10, 3, true),
      strategy(13, 10, 4, true),
    ];
    expect(resolveVisibleStrategyId(11, bothCurrent, strategy(11, 10, 2))).toBe(13);
  });

  it('ne remplace pas une version encore visible', () => {
    const bothVisible = [
      strategy(12, 10, 3, true),
      strategy(14, 10, 2, false),
    ];
    expect(resolveVisibleStrategyId(14, bothVisible, strategy(11, 10, 1))).toBe(14);
  });

  it('garde un identifiant inconnu', () => {
    expect(resolveVisibleStrategyId(99, visible, null)).toBe(99);
    expect(resolveVisibleStrategyId(99, visible)).toBe(99);
  });

  it('garde l’identifiant si toute la famille est archivée', () => {
    expect(resolveVisibleStrategyId(11, visible, strategy(11, 30, 2))).toBe(11);
  });
});
