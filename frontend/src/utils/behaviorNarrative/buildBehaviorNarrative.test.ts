import { classifyNarrativeTone } from './classifyNarrativeTone';
import { aggregateHourlyPerformance } from './aggregateBehaviorTimeContext';
import { buildBehaviorNarrative } from './buildBehaviorNarrative';
import type { BehaviorNarrativeContext } from './types';
import { BEHAVIOR_NARRATIVE_MIN_TRADES } from './types';

const t = (key: string, options?: Record<string, unknown>): string => {
  if (options) {
    return `${key}|${JSON.stringify(options)}`;
  }
  return key;
};

const formatNumber = (value: number, digits = 2) => value.toFixed(digits);
const formatCurrency = (value: number, symbol = '') => `${symbol}${value.toFixed(0)}`;

function baseContext(overrides: Partial<BehaviorNarrativeContext> = {}): BehaviorNarrativeContext {
  const partial = {
    tradeCount: 50,
    profitFactor: 2.1,
    sharpeAnnualized: 2.5,
    expectancy: 100,
    winRate: 65,
    maxConsecutiveWins: 14,
    maxConsecutiveLosses: 3,
    revenge: {
      alertLevel: 'none' as const,
      hasSufficientData: true,
      pctIncrease: 5,
      avgAfterLoss: 3,
      avgAfterWin: 2.8,
    },
    sizing: {
      alertLevel: 'none' as const,
      hasSufficientData: true,
      pctLargerOnLosers: 5,
    },
    worstMonthLabel: null,
    hourly: [
      { hour: 17, totalPnl: 500, tradeCount: 10 },
      { hour: 19, totalPnl: 400, tradeCount: 8 },
      { hour: 18, totalPnl: -257, tradeCount: 6 },
    ],
    weekday: [
      { day: 'Vendredi', totalPnl: 5300, tradeCount: 25, winRate: 88 },
      { day: 'Mardi', totalPnl: -200, tradeCount: 12, winRate: 35 },
    ],
    weekly: [{ isoYear: 2025, isoWeek: 20, totalPnl: 4623, tradeCount: 21, winRate: 81 }],
    durationBuckets: [
      {
        label: '> 30m',
        avgPnl: 261,
        winRate: 60,
        tradeCount: 5,
        winningCount: 3,
        losingCount: 2,
        breakevenCount: 0,
      },
      {
        label: '5-10m',
        avgPnl: 120,
        winRate: 72,
        tradeCount: 18,
        winningCount: 13,
        losingCount: 5,
        breakevenCount: 0,
      },
    ],
    monthlyPerformance: [
      { month: '2025-03', pnl: 1000 },
      { month: '2025-04', pnl: -500 },
      { month: '2025-05', pnl: 2000 },
    ],
    timezone: 'Europe/Paris',
    trajectoryProgression: true,
    trajectoryVolatile: false,
    ...overrides,
  };

  const tone =
    overrides.tone ??
    classifyNarrativeTone({
      profitFactor: partial.profitFactor ?? null,
      sharpeAnnualized: partial.sharpeAnnualized ?? null,
      expectancy: partial.expectancy ?? 0,
      revenge: partial.revenge ?? null,
      sizing: partial.sizing ?? null,
      trajectoryProgression: partial.trajectoryProgression ?? false,
      trajectoryVolatile: partial.trajectoryVolatile ?? false,
    });

  return { ...partial, tone };
}

describe('buildBehaviorNarrative', () => {
  it('retourne un message unique si pas assez de trades', () => {
    const sections = buildBehaviorNarrative({
      context: baseContext({ tradeCount: BEHAVIOR_NARRATIVE_MIN_TRADES - 1 }),
      t,
      formatNumber,
      formatCurrency,
      currencySymbol: '$',
    });

    expect(sections).toHaveLength(1);
    expect(sections[0].paragraphs[0]).toContain('insufficientData.body');
  });

  it('inclut une intro et la section forces pour un trader solide', () => {
    const sections = buildBehaviorNarrative({
      context: baseContext({ tone: 'excellent' }),
      t,
      formatNumber,
      formatCurrency,
      currencySymbol: '$',
    });

    expect(sections[0].id).toBe('intro');
    expect(sections[0].paragraphs[0]).toContain('intro.excellent');

    const strengths = sections.find((s) => s.id === 'strengths');
    expect(strengths).toBeDefined();
    expect(strengths!.titleKey).toContain('strengths.title.excellent');
    expect(strengths!.paragraphs.some((p) => p.includes('profitFactorGood'))).toBe(true);
  });

  it('n utilise pas profitFactorGood quand le PF est faible', () => {
    const sections = buildBehaviorNarrative({
      context: baseContext({
        profitFactor: 0.7,
        sharpeAnnualized: 0.3,
        expectancy: -50,
        tone: 'challenging',
        revenge: {
          alertLevel: 'warning',
          hasSufficientData: true,
          pctIncrease: 58,
          avgAfterLoss: 4.9,
          avgAfterWin: 3.1,
        },
        sizing: {
          alertLevel: 'warning',
          hasSufficientData: true,
          pctLargerOnLosers: 15,
        },
        trajectoryProgression: false,
        trajectoryVolatile: true,
      }),
      t,
      formatNumber,
      formatCurrency,
      currencySymbol: '$',
    });

    const strengths = sections.find((s) => s.id === 'strengths');
    expect(strengths?.paragraphs.some((p) => p.includes('profitFactorGood'))).toBe(false);
    expect(strengths?.paragraphs.some((p) => p.includes('profitFactorPoor'))).toBe(true);

    const alerts = sections.find((s) => s.id === 'alerts');
    expect(alerts?.paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(alerts?.paragraphs[0]).toContain('revengeEncourage');
  });

  it('utilise profitFactorAverage pour un PF moyen', () => {
    const sections = buildBehaviorNarrative({
      context: baseContext({
        profitFactor: 1.4,
        sharpeAnnualized: 0.7,
        expectancy: 10,
        tone: 'mixed',
      }),
      t,
      formatNumber,
      formatCurrency,
      currencySymbol: '$',
    });

    const strengths = sections.find((s) => s.id === 'strengths');
    expect(strengths?.paragraphs.some((p) => p.includes('profitFactorAverage'))).toBe(true);
    expect(strengths?.paragraphs.some((p) => p.includes('profitFactorGood'))).toBe(false);
  });
});

describe('aggregateHourlyPerformance', () => {
  it('agrège les heures selon le fuseau utilisateur', () => {
    const trades = [
      {
        entered_at: '2025-05-15T15:00:00.000Z',
        pnl: '100',
        net_pnl: '100',
      },
    ];

    const paris = aggregateHourlyPerformance(trades, 'Europe/Paris', 'net');
    const ny = aggregateHourlyPerformance(trades, 'America/New_York', 'net');

    const parisHour = paris.find((h) => h.tradeCount > 0)?.hour;
    const nyHour = ny.find((h) => h.tradeCount > 0)?.hour;

    expect(parisHour).toBeDefined();
    expect(nyHour).toBeDefined();
    expect(parisHour).not.toBe(nyHour);
  });
});
