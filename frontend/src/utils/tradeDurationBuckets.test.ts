import {
  aggregateDurationDistribution,
  aggregateDurationPerformance,
  categorizeDuration,
  classifyTradeOutcomeFromPnl,
  formatDurationBucketLabel,
  getTradeDurationMinutesForBucket,
} from './tradeDurationBuckets';

describe('tradeDurationBuckets', () => {
  describe('categorizeDuration', () => {
    it('affiche les libellés d’abscisse (< 5m, > 30m)', () => {
      expect(formatDurationBucketLabel('5m')).toBe('< 5m');
      expect(formatDurationBucketLabel('30-45m')).toBe('> 30m');
      expect(formatDurationBucketLabel('5-10m')).toBe('5-10m');
    });

    it('utilise les mêmes seuils que le dashboard', () => {
      expect(categorizeDuration(4.9)).toBe('5m');
      expect(categorizeDuration(5)).toBe('5-10m');
      expect(categorizeDuration(9.9)).toBe('5-10m');
      expect(categorizeDuration(45)).toBe('45-60m');
      expect(categorizeDuration(60)).toBe('30-45m');
      expect(categorizeDuration(120)).toBe('30-45m');
    });
  });

  describe('getTradeDurationMinutesForBucket', () => {
    it('lit uniquement trade_duration, pas entered_at/exited_at', () => {
      expect(
        getTradeDurationMinutesForBucket({
          trade_duration: '00:07:00',
          entered_at: '2026-01-01T10:00:00Z',
          exited_at: '2026-01-01T12:00:00Z',
        })
      ).toBe(7);
    });

    it('ignore un trade sans trade_duration', () => {
      expect(
        getTradeDurationMinutesForBucket({
          entered_at: '2026-01-01T10:00:00Z',
          exited_at: '2026-01-01T10:30:00Z',
        })
      ).toBeNull();
    });
  });

  describe('classifyTradeOutcomeFromPnl', () => {
    it('traite le break-even à part (pas comme une perte)', () => {
      expect(classifyTradeOutcomeFromPnl(10)).toBe('win');
      expect(classifyTradeOutcomeFromPnl(-1)).toBe('loss');
      expect(classifyTradeOutcomeFromPnl(0)).toBe('breakeven');
    });
  });

  describe('aggregateDurationPerformance', () => {
    const trades = [
      {
        trade_duration: '00:03:00',
        pnl: '100',
        net_pnl: '80',
      },
      {
        trade_duration: '00:03:00',
        pnl: '-50',
        net_pnl: '-60',
      },
      {
        trade_duration: '00:03:00',
        pnl: '0',
        net_pnl: '0',
      },
      {
        trade_duration: '00:08:00',
        pnl: '200',
        net_pnl: '150',
      },
    ];

    it('mode net : win rate = gains / tous les trades de la tranche (API stats)', () => {
      const rows = aggregateDurationPerformance(trades, 'net');
      const bucket5m = rows.find((r) => r.label === '< 5m');
      expect(bucket5m).toBeDefined();
      expect(bucket5m?.tradeCount).toBe(3);
      expect(bucket5m?.winningCount).toBe(1);
      expect(bucket5m?.losingCount).toBe(1);
      expect(bucket5m?.breakevenCount).toBe(1);
      expect(bucket5m?.avgPnl).toBeCloseTo((80 - 60 + 0) / 3, 5);
      expect(bucket5m?.winRate).toBeCloseTo((1 / 3) * 100, 5);
    });

    it('mode gross : classe selon pnl brut, pas is_profitable (net)', () => {
      const rows = aggregateDurationPerformance(trades, 'gross');
      const bucket5m = rows.find((r) => r.label === '< 5m');
      expect(bucket5m?.avgPnl).toBeCloseTo((100 - 50 + 0) / 3, 5);
      expect(bucket5m?.winningCount).toBe(1);
      expect(bucket5m?.losingCount).toBe(1);
    });

    it('distribution et performance partagent le même décompte par tranche', () => {
      const perf = aggregateDurationPerformance(trades, 'net');
      const dist = aggregateDurationDistribution(trades, 'net');
      const p5 = perf.find((r) => r.label === '< 5m');
      const d5 = dist.find((r) => r.label === '< 5m');
      expect(p5?.winningCount).toBe(d5?.winning);
      expect(p5?.losingCount).toBe(d5?.losing);
      expect(p5!.winningCount + p5!.losingCount).toBe(d5?.total);
    });
  });
});
