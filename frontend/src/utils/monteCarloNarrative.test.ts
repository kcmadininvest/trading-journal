import type { TFunction } from 'i18next';
import {
  buildMonteCarloNarrative,
  classifyProbabilityTone,
  classifyTimelinePacing,
  formatProjectedMonthLabel,
  tradingDaysToCalendarDays,
  weeksToMonths,
} from './monteCarloNarrative';

const mockT = ((key: string, params?: Record<string, unknown>) => {
  if (!params) return key;
  return `${key}:${JSON.stringify(params)}`;
}) as TFunction;

const baseInput = {
  currentBalance: 5_000,
  nextMilestone: {
    balance: 5_833,
    daysEstimate: 7,
    pct: 16.67,
  },
  mu: 120,
  sigma: 80,
  tradingDayCount: 45,
  tradingDaysPerWeek: 5,
  isExposureAdjusted: false,
  exposureRatio: 1,
  language: 'fr' as const,
  t: mockT,
  formatNumber: (value: number, digits = 2) => value.toFixed(digits),
  formatTarget: (value: number) => `$${value}`,
  formatMoney: (value: number) => `$${value}`,
  formatDayCount: (days: number | null) => (days == null ? '—' : `${days}d`),
  formatWeekCount: (days: number | null) => (days == null ? '—' : `${days}w`),
  referenceDate: new Date(2026, 5, 8),
};

function sectionTexts(result: ReturnType<typeof buildMonteCarloNarrative>): string[] {
  return result.sections.map((section) => section.text);
}

describe('monteCarloNarrative', () => {
  it('classifies probability tones by threshold', () => {
    expect(classifyProbabilityTone(99.97)).toBe('certainty');
    expect(classifyProbabilityTone(95)).toBe('certainty');
    expect(classifyProbabilityTone(85)).toBe('veryLikely');
    expect(classifyProbabilityTone(70)).toBe('likely');
    expect(classifyProbabilityTone(50)).toBe('uncertain');
    expect(classifyProbabilityTone(30)).toBe('unlikely');
    expect(classifyProbabilityTone(10)).toBe('veryUnlikely');
  });

  it('converts trading days to calendar days', () => {
    expect(tradingDaysToCalendarDays(20, 5)).toBe(28);
    expect(tradingDaysToCalendarDays(60, 5)).toBe(84);
  });

  it('rounds weeks to months with minimum of 1', () => {
    expect(weeksToMonths(4)).toBe(1);
    expect(weeksToMonths(18)).toBe(4);
  });

  it('classifies timeline pacing from success rate and spread', () => {
    expect(classifyTimelinePacing(90, 16, 18)).toBe('relaxed');
    expect(classifyTimelinePacing(90, 10, 20)).toBe('patient');
    expect(classifyTimelinePacing(50, 10, 20)).toBe('cautious');
    expect(classifyTimelinePacing(70, 10, 20)).toBe('steady');
  });

  it('formats projected month labels with qualifier', () => {
    const early = formatProjectedMonthLabel(new Date(2026, 8, 5), 'fr', mockT);
    const late = formatProjectedMonthLabel(new Date(2026, 11, 25), 'fr', mockT);

    expect(early).toContain('dateEarly');
    expect(late).toContain('dateLate');
  });

  it('builds full sections with gap, horizon failure, milestone and sizing', () => {
    const result = buildMonteCarloNarrative({
      ...baseInput,
      simulation: { successRate: 88, p25: 80, p75: 120, median: 100 },
      targetBalance: 10_000,
      isExposureAdjusted: true,
      exposureRatio: 0.25,
    });

    const texts = sectionTexts(result);

    expect(result.sections).toHaveLength(8);
    expect(result.probabilityTone).toBe('veryLikely');
    expect(texts[0]).toContain('probability.veryLikely');
    expect(texts[0]).toContain('withSizing');
    expect(texts[1]).toContain('gap.remaining');
    expect(texts[2]).toContain('horizon.failure');
    expect(texts[3]).toContain('typical.withDuration');
    expect(texts[4]).toContain('timeline.');
    expect(texts[5]).toContain('milestone.next');
    expect(texts[6]).toContain('assumptions.base');
    expect(texts[6]).toContain('assumptions.adjusted');
    expect(texts[7]).toContain('history.standard');
  });

  it('omits horizon failure when success rate is effectively 100%', () => {
    const result = buildMonteCarloNarrative({
      ...baseInput,
      simulation: { successRate: 100, p25: 80, p75: 120, median: 100 },
      targetBalance: 10_000,
    });

    const texts = sectionTexts(result);

    expect(texts.some((text) => text.includes('horizon.failure'))).toBe(false);
  });

  it('includes typical median section and standard history', () => {
    const result = buildMonteCarloNarrative({
      ...baseInput,
      simulation: { successRate: 88, p25: 60, p75: 90, median: 75 },
      targetBalance: 10_000,
    });

    const texts = sectionTexts(result);

    expect(texts.some((text) => text.includes('typical.withDuration'))).toBe(true);
    expect(texts.some((text) => text.includes('history.standard'))).toBe(true);
  });

  it('uses limited history message when trading days are below threshold', () => {
    const result = buildMonteCarloNarrative({
      ...baseInput,
      tradingDayCount: 12,
      simulation: { successRate: 75, p25: 40, p75: 80, median: 60 },
      targetBalance: 10_000,
    });

    const texts = sectionTexts(result);

    expect(texts.some((text) => text.includes('history.limited'))).toBe(true);
  });

  it('uses single-month timeline when p25 equals p75', () => {
    const result = buildMonteCarloNarrative({
      ...baseInput,
      simulation: { successRate: 88, p25: 60, p75: 60, median: 60 },
      targetBalance: 10_000,
      formatNumber: (value, digits = 0) => String(Math.round(value)),
    });

    const timelineSection = result.sections.find((section) =>
      section.text.includes('timeline.'),
    );

    expect(timelineSection?.text).toContain('singleMonth');
  });

  it('falls back to insufficient timeline when percentiles are missing', () => {
    const result = buildMonteCarloNarrative({
      ...baseInput,
      simulation: { successRate: 75, p25: null, p75: 120, median: null },
      targetBalance: 10_000,
      formatNumber: (value) => String(value),
    });

    const timelineSection = result.sections.find((section) =>
      section.text.includes('timeline.'),
    );

    expect(timelineSection?.text).toBe('analytics:monteCarlo.narrative.timeline.insufficient');
  });

  it('falls back to insufficient typical when median is missing', () => {
    const result = buildMonteCarloNarrative({
      ...baseInput,
      simulation: { successRate: 75, p25: 40, p75: 80, median: null },
      targetBalance: 10_000,
    });

    const typicalSection = result.sections.find((section) =>
      section.text.includes('typical.'),
    );

    expect(typicalSection?.text).toBe('analytics:monteCarlo.narrative.typical.insufficient');
  });

  it('omits milestone section when next milestone is null', () => {
    const result = buildMonteCarloNarrative({
      ...baseInput,
      nextMilestone: null,
      simulation: { successRate: 88, p25: 60, p75: 90, median: 75 },
      targetBalance: 10_000,
    });

    expect(result.sections.some((section) => section.text.includes('milestone.next'))).toBe(false);
  });
});
