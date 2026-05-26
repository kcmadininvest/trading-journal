import {
  aggregatePositionSizePerformance,
  formatPositionSizeLabel,
  normalizePositionSize,
} from './positionSizePerformance';

describe('positionSizePerformance', () => {
  describe('normalizePositionSize', () => {
    it('arrondit à 2 décimales', () => {
      expect(normalizePositionSize(1.0000001)).toBe(1);
      expect(normalizePositionSize(2.555)).toBe(2.56);
    });
  });

  describe('formatPositionSizeLabel', () => {
    it('affiche les entiers sans décimales', () => {
      expect(formatPositionSizeLabel(10)).toBe('10');
      expect(formatPositionSizeLabel(2.5)).toBe('2.5');
    });
  });

  describe('aggregatePositionSizePerformance', () => {
    const trades = [
      { size: '1', pnl: '100', net_pnl: '80' },
      { size: '1', pnl: '-50', net_pnl: '-60' },
      { size: '1', pnl: '0', net_pnl: '0' },
      { size: '2', pnl: '200', net_pnl: '150' },
      { size: '1.0000001', pnl: '10', net_pnl: '10' },
      { size: '0', pnl: '100', net_pnl: '100' },
      { size: '3', pnl: null, net_pnl: null },
    ];

    it('agrège par taille avec win rate = gains / tous les trades de la taille', () => {
      const rows = aggregatePositionSizePerformance(trades, 'net');
      const size1 = rows.find((r) => r.size === 1);
      expect(size1).toBeDefined();
      expect(size1?.tradeCount).toBe(4);
      expect(size1?.winningCount).toBe(2);
      expect(size1?.losingCount).toBe(1);
      expect(size1?.breakevenCount).toBe(1);
      expect(size1?.avgPnl).toBeCloseTo((80 - 60 + 0 + 10) / 4, 5);
      expect(size1?.winRate).toBeCloseTo((2 / 4) * 100, 5);
      expect(size1?.label).toBe('1');
    });

    it('trie les tailles par ordre croissant', () => {
      const rows = aggregatePositionSizePerformance(trades, 'net');
      expect(rows.map((r) => r.size)).toEqual([1, 2]);
    });

    it('mode gross : classe selon pnl brut', () => {
      const rows = aggregatePositionSizePerformance(trades, 'gross');
      const size1 = rows.find((r) => r.size === 1);
      expect(size1?.avgPnl).toBeCloseTo((100 - 50 + 0 + 10) / 4, 5);
    });

    it('ignore tailles invalides et P/L manquants', () => {
      const rows = aggregatePositionSizePerformance(trades, 'net');
      expect(rows.some((r) => r.size === 0)).toBe(false);
      expect(rows.some((r) => r.size === 3)).toBe(false);
    });
  });
});
