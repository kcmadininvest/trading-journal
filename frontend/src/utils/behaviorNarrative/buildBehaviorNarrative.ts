import { GAUGE_CONFIGS } from '../../components/statistics/MetricGauge';
import { getGaugeVerdict } from '../getGaugeVerdict';
import { WEEKDAY_WIN_RATE_MIN_TRADES } from './aggregateBehaviorTimeContext';
import { resolveSectionTitle } from './resolveSectionTitle';
import type { BuildBehaviorNarrativeInput, NarrativeSection, NarrativeTone } from './types';
import {
  BEHAVIOR_NARRATIVE_LOW_VOLUME_BUCKET,
  BEHAVIOR_NARRATIVE_MIN_PLANNED_RR_TRADES,
  BEHAVIOR_NARRATIVE_MIN_STREAK_WINS,
  BEHAVIOR_NARRATIVE_MIN_TRADES,
  BEHAVIOR_NARRATIVE_MIN_TRADES_PER_HOUR,
  BEHAVIOR_NARRATIVE_POST_SIZING_MIN_SAMPLE,
  BEHAVIOR_NARRATIVE_SWEET_SPOT_MIN_TRADES,
  HEALTHY_TRADES_PER_DAY_MAX,
  HEALTHY_TRADES_PER_DAY_MIN,
  OVERTRADING_TRADES_PER_DAY_THRESHOLD,
} from './types';
import type { NarrativeHighlight } from './types';

function formatHourLabel(hour: number): string {
  return `${hour}h`;
}

function isCelebrateTone(tone: NarrativeTone): boolean {
  return tone === 'excellent' || tone === 'positive';
}

function pickTopHours(
  hourly: BuildBehaviorNarrativeInput['context']['hourly'],
  minTrades: number,
) {
  const eligible = hourly.filter((h) => h.tradeCount >= minTrades);
  const sorted = [...eligible].sort((a, b) => b.totalPnl - a.totalPnl);
  const best = sorted.filter((h) => h.totalPnl > 0).slice(0, 2);
  const worst = [...eligible].sort((a, b) => a.totalPnl - b.totalPnl).find((h) => h.totalPnl < 0);
  return { best, worst };
}

function pickWeekdayExtremes(weekday: BuildBehaviorNarrativeInput['context']['weekday']) {
  const eligible = weekday.filter((d) => d.tradeCount >= WEEKDAY_WIN_RATE_MIN_TRADES);
  if (eligible.length === 0) return { best: null, worst: null };

  const best = [...eligible].sort((a, b) => b.totalPnl - a.totalPnl)[0] ?? null;
  const worst = [...eligible].sort((a, b) => a.totalPnl - b.totalPnl)[0] ?? null;
  return { best, worst };
}

function buildIntroSection(input: BuildBehaviorNarrativeInput): NarrativeSection {
  const { context, t } = input;
  return {
    id: 'intro',
    titleKey: 'behaviorNarrative.intro.heading',
    paragraphs: [
      t(`analytics:behaviorNarrative.intro.${context.tone}`),
      t('analytics:behaviorNarrative.intro.tradeCount', { count: context.tradeCount }),
    ],
    toneVariant: context.tone,
    kind: 'prose',
  };
}

function buildStrengthsSection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t, formatNumber, formatCurrency, currencySymbol } = input;
  const paragraphs: string[] = [];
  const highlights: NarrativeHighlight[] = [];
  const tone = context.tone;

  highlights.push({
    labelKey: 'behaviorNarrative.ui.kpiWinRate',
    value: `${formatNumber(context.winRate, 1)}%`,
    tone: context.winRate >= 50 ? 'positive' : context.winRate < 40 ? 'negative' : 'neutral',
  });

  if (context.profitFactor != null) {
    highlights.push({
      labelKey: 'behaviorNarrative.ui.kpiProfitFactor',
      value: formatNumber(context.profitFactor, 2),
      tone:
        getGaugeVerdict(context.profitFactor, GAUGE_CONFIGS.profitFactor) === 'good'
          ? 'positive'
          : 'neutral',
    });
    const verdict = getGaugeVerdict(context.profitFactor, GAUGE_CONFIGS.profitFactor);
    if (verdict === 'good') {
      paragraphs.push(
        t('analytics:behaviorNarrative.strengths.profitFactorGood', {
          profitFactor: formatNumber(context.profitFactor, 2),
        }),
      );
    } else if (verdict === 'average') {
      paragraphs.push(
        t('analytics:behaviorNarrative.strengths.profitFactorAverage', {
          profitFactor: formatNumber(context.profitFactor, 2),
        }),
      );
    } else {
      paragraphs.push(
        t('analytics:behaviorNarrative.strengths.profitFactorPoor', {
          profitFactor: formatNumber(context.profitFactor, 2),
        }),
      );
    }
  }

  if (context.sharpeAnnualized != null) {
    highlights.push({
      labelKey: 'behaviorNarrative.ui.kpiSharpe',
      value: formatNumber(context.sharpeAnnualized, 2),
      tone:
        getGaugeVerdict(context.sharpeAnnualized, GAUGE_CONFIGS.sharpeRatioAnnualized) === 'good'
          ? 'positive'
          : 'neutral',
    });
    const verdict = getGaugeVerdict(context.sharpeAnnualized, GAUGE_CONFIGS.sharpeRatioAnnualized);
    if (verdict === 'good') {
      const key =
        context.sharpeAnnualized >= 2
          ? 'analytics:behaviorNarrative.strengths.sharpeExcellent'
          : 'analytics:behaviorNarrative.strengths.sharpeGood';
      paragraphs.push(
        t(key, {
          sharpe: formatNumber(context.sharpeAnnualized, 2),
        }),
      );
    } else if (verdict === 'average') {
      paragraphs.push(
        t('analytics:behaviorNarrative.strengths.sharpeAverage', {
          sharpe: formatNumber(context.sharpeAnnualized, 2),
        }),
      );
    } else {
      paragraphs.push(
        t('analytics:behaviorNarrative.strengths.sharpePoor', {
          sharpe: formatNumber(context.sharpeAnnualized, 2),
        }),
      );
    }
  }

  const winVerdict =
    context.winRate >= 55 ? 'good' : context.winRate >= 45 ? 'average' : 'poor';
  paragraphs.push(
    t(`analytics:behaviorNarrative.strengths.winRate${winVerdict === 'good' ? 'Good' : winVerdict === 'average' ? 'Average' : 'Poor'}`, {
      winRate: formatNumber(context.winRate, 1),
    }),
  );

  if (context.monetaryNarrativesEnabled) {
    if (context.expectancy !== 0) {
      const expKey =
        context.expectancy > 0
          ? 'analytics:behaviorNarrative.strengths.expectancyPositive'
          : 'analytics:behaviorNarrative.strengths.expectancyNegative';
      paragraphs.push(
        t(expKey, {
          expectancy: formatCurrency(context.expectancy, currencySymbol),
        }),
      );
    }
  }

  if (
    context.maxConsecutiveWins >= BEHAVIOR_NARRATIVE_MIN_STREAK_WINS &&
    context.maxConsecutiveWins > context.maxConsecutiveLosses
  ) {
    paragraphs.push(
      t('analytics:behaviorNarrative.strengths.streaks', {
        maxWins: context.maxConsecutiveWins,
        maxLosses: context.maxConsecutiveLosses,
      }),
    );
  }

  if (paragraphs.length === 0 && tone === 'challenging') {
    paragraphs.push(t('analytics:behaviorNarrative.strengths.encourageNoMetrics'));
  }

  if (paragraphs.length === 0) return null;

  return {
    id: 'strengths',
    titleKey: resolveSectionTitle('strengths', tone),
    paragraphs,
    highlights,
    kind: 'highlight',
    toneVariant: tone,
  };
}

function buildAlertsSection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t, formatNumber } = input;
  const paragraphs: string[] = [];
  const tone = context.tone;

  const revengeWarning =
    context.revenge?.alertLevel === 'warning' &&
    context.revenge.hasSufficientData &&
    context.revenge.pctIncrease != null;

  const sizingWarning =
    context.sizing?.alertLevel === 'warning' &&
    context.sizing.hasSufficientData &&
    context.sizing.pctLargerOnLosers != null;

  const alertHighlights: NarrativeHighlight[] = [];

  if (revengeWarning && context.revenge) {
    let text = t('analytics:behaviorNarrative.alerts.revengeEncourage', {
      afterLoss: formatNumber(context.revenge.avgAfterLoss, 1),
      afterWin: formatNumber(context.revenge.avgAfterWin, 1),
    });
    if (context.worstMonthLabel) {
      text += ` ${t('analytics:behaviorNarrative.alerts.revengeWorstMonth', {
        month: context.worstMonthLabel,
      })}`;
    }
    paragraphs.push(text);
    alertHighlights.push({
      labelKey: 'behaviorNarrative.ui.alertRevenge',
      value: `+${formatNumber(context.revenge.pctIncrease!, 0)}%`,
      tone: 'negative',
    });
  }

  if (sizingWarning && context.sizing) {
    paragraphs.push(
      t('analytics:behaviorNarrative.alerts.sizingEncourage', {
        pct: formatNumber(context.sizing.pctLargerOnLosers!, 0),
      }),
    );
    alertHighlights.push({
      labelKey: 'behaviorNarrative.ui.alertSizing',
      value: `+${formatNumber(context.sizing.pctLargerOnLosers!, 0)}%`,
      tone: 'negative',
    });
  }

  if (paragraphs.length === 0) {
    const hasDisciplineData =
      (context.revenge?.hasSufficientData ?? false) || (context.sizing?.hasSufficientData ?? false);
    if (!hasDisciplineData) return null;

    const cleanKey = isCelebrateTone(tone)
      ? 'analytics:behaviorNarrative.alerts.congratulateClean'
      : tone === 'mixed'
        ? 'analytics:behaviorNarrative.alerts.neutralClean'
        : 'analytics:behaviorNarrative.alerts.none';

    return {
      id: 'alerts',
      titleKey: resolveSectionTitle('alerts', tone, { alertsState: 'clean' }),
      paragraphs: [t(cleanKey)],
      toneVariant: tone,
      kind: 'prose',
    };
  }

  return {
    id: 'alerts',
    titleKey: resolveSectionTitle('alerts', tone, { alertsState: 'warnings' }),
    paragraphs,
    highlights: alertHighlights.length > 0 ? alertHighlights : undefined,
    kind: alertHighlights.length > 0 ? 'alert' : 'prose',
    toneVariant: tone,
  };
}

function buildTimeWindowsSection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t, formatNumber, formatCurrency, currencySymbol } = input;
  const tone = context.tone;
  const monetary = context.monetaryNarrativesEnabled;
  const { best, worst } = pickTopHours(context.hourly, BEHAVIOR_NARRATIVE_MIN_TRADES_PER_HOUR);
  const { best: bestDay, worst: worstDay } = pickWeekdayExtremes(context.weekday);

  if (best.length === 0 && !worst && !bestDay && !worstDay) return null;

  const paragraphs: string[] = [];

  if (best.length > 0) {
    const hours = best.map((h) => formatHourLabel(h.hour)).join(', ');
    const key = isCelebrateTone(tone)
      ? 'analytics:behaviorNarrative.timeWindows.bestHoursCelebrate'
      : 'analytics:behaviorNarrative.timeWindows.bestHours';
    paragraphs.push(
      t(key, {
        hours,
        timezone: context.timezone,
      }),
    );
  }

  if (worst && monetary) {
    paragraphs.push(
      t('analytics:behaviorNarrative.timeWindows.worstHourEncourage', {
        hour: formatHourLabel(worst.hour),
        timezone: context.timezone,
        pnl: formatCurrency(worst.totalPnl, currencySymbol),
      }),
    );
  }

  if (bestDay && worstDay && bestDay.day !== worstDay.day) {
    if (monetary) {
      const key = isCelebrateTone(tone)
        ? 'analytics:behaviorNarrative.timeWindows.weekdaysCelebrate'
        : 'analytics:behaviorNarrative.timeWindows.weekdays';
      paragraphs.push(
        t(key, {
          bestDay: bestDay.day,
          bestWinRate: formatNumber(bestDay.winRate, 0),
          bestPnl: formatCurrency(bestDay.totalPnl, currencySymbol),
          worstDay: worstDay.day,
        }),
      );
    } else {
      paragraphs.push(
        t('analytics:behaviorNarrative.timeWindows.weekdaysNoMoney', {
          bestDay: bestDay.day,
          bestWinRate: formatNumber(bestDay.winRate, 0),
          worstDay: worstDay.day,
        }),
      );
    }
  }

  if (paragraphs.length === 0) return null;

  return {
    id: 'timeWindows',
    titleKey: resolveSectionTitle('timeWindows', tone),
    paragraphs,
    toneVariant: tone,
  };
}

function buildDurationSection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t, formatNumber, formatCurrency, currencySymbol } = input;
  if (!context.monetaryNarrativesEnabled) return null;
  const tone = context.tone;
  const buckets = context.durationBuckets;
  if (buckets.length === 0) return null;

  const bestAvg = [...buckets].sort((a, b) => b.avgPnl - a.avgPnl)[0];
  const sweetSpotCandidates = buckets.filter((b) => b.tradeCount >= BEHAVIOR_NARRATIVE_SWEET_SPOT_MIN_TRADES);
  const sweetSpot =
    sweetSpotCandidates.length > 0
      ? [...sweetSpotCandidates].sort((a, b) => b.avgPnl - a.avgPnl)[0]
      : null;

  const paragraphs: string[] = [];

  if (bestAvg && bestAvg !== sweetSpot) {
    const lowVolume = bestAvg.tradeCount < BEHAVIOR_NARRATIVE_LOW_VOLUME_BUCKET;
    paragraphs.push(
      t(
        lowVolume
          ? 'analytics:behaviorNarrative.duration.bestAvgLowVolume'
          : 'analytics:behaviorNarrative.duration.bestAvg',
        {
          label: bestAvg.label,
          avgPnl: formatCurrency(bestAvg.avgPnl, currencySymbol),
          count: bestAvg.tradeCount,
        },
      ),
    );
  }

  if (sweetSpot) {
    const key = isCelebrateTone(tone)
      ? 'analytics:behaviorNarrative.duration.sweetSpotCelebrate'
      : 'analytics:behaviorNarrative.duration.sweetSpot';
    paragraphs.push(
      t(key, {
        label: sweetSpot.label,
        winRate: formatNumber(sweetSpot.winRate, 0),
        avgPnl: formatCurrency(sweetSpot.avgPnl, currencySymbol),
        count: sweetSpot.tradeCount,
      }),
    );
  } else if (bestAvg) {
    paragraphs.push(
      t('analytics:behaviorNarrative.duration.onlyBucket', {
        label: bestAvg.label,
        avgPnl: formatCurrency(bestAvg.avgPnl, currencySymbol),
        winRate: formatNumber(bestAvg.winRate, 0),
      }),
    );
  }

  if (paragraphs.length === 0) return null;

  return {
    id: 'duration',
    titleKey: resolveSectionTitle('duration', tone),
    paragraphs,
    toneVariant: tone,
  };
}

function buildRiskSection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t, formatNumber, formatCurrency, currencySymbol } = input;
  if (!context.monetaryNarrativesEnabled) return null;
  const tone = context.tone;
  const paragraphs: string[] = [];

  if (context.maxDrawdownPct != null) {
    const ddKey =
      context.maxDrawdownPct > 15
        ? 'analytics:behaviorNarrative.risk.drawdownHigh'
        : 'analytics:behaviorNarrative.risk.drawdownModerate';
    paragraphs.push(
      t(ddKey, {
        drawdownPct: formatNumber(context.maxDrawdownPct, 1),
        drawdownAmount:
          context.maxDrawdownGlobal != null
            ? formatCurrency(context.maxDrawdownGlobal, currencySymbol)
            : '—',
      }),
    );
  }

  if (context.recoveryRatio != null) {
    const recKey =
      context.recoveryRatio >= 1
        ? 'analytics:behaviorNarrative.risk.recoveryGood'
        : 'analytics:behaviorNarrative.risk.recoveryLow';
    paragraphs.push(
      t(recKey, {
        recovery: formatNumber(context.recoveryRatio, 2),
      }),
    );
  }

  if (paragraphs.length === 0) return null;

  return {
    id: 'risk',
    titleKey: resolveSectionTitle('risk', tone),
    paragraphs,
    toneVariant: tone,
  };
}

function buildRhythmSection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t, formatNumber, formatCurrency, currencySymbol, formatDate } = input;
  const rhythm = context.dailyRhythm;
  if (!rhythm) return null;

  const paragraphs: string[] = [];
  const tone = context.tone;
  const avg = rhythm.avgTradesPerDay;

  if (avg > OVERTRADING_TRADES_PER_DAY_THRESHOLD) {
    paragraphs.push(
      t('analytics:behaviorNarrative.rhythm.overtrading', {
        count: formatNumber(avg, 1),
      }),
    );
  } else if (avg >= HEALTHY_TRADES_PER_DAY_MIN && avg <= HEALTHY_TRADES_PER_DAY_MAX) {
    paragraphs.push(
      t('analytics:behaviorNarrative.rhythm.healthyPace', {
        count: formatNumber(avg, 1),
      }),
    );
  }

  if (context.monetaryNarrativesEnabled && rhythm.worstDay && rhythm.worstDayPnl != null && rhythm.worstDayPnl < 0) {
    paragraphs.push(
      t('analytics:behaviorNarrative.rhythm.worstDay', {
        day: formatDate(rhythm.worstDay),
        pnl: formatCurrency(rhythm.worstDayPnl, currencySymbol),
      }),
    );
  } else if (!context.monetaryNarrativesEnabled && rhythm.worstDay) {
    paragraphs.push(
      t('analytics:behaviorNarrative.rhythm.worstDayNoMoney', {
        day: formatDate(rhythm.worstDay),
      }),
    );
  }

  if (paragraphs.length === 0) return null;

  return {
    id: 'rhythm',
    titleKey: resolveSectionTitle('rhythm', tone),
    paragraphs,
    toneVariant: tone,
  };
}

function buildHabitsSection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t } = input;
  const paragraphs: string[] = [];

  if (
    context.postLossSampleSize >= BEHAVIOR_NARRATIVE_POST_SIZING_MIN_SAMPLE &&
    context.postLossDominantCategory
  ) {
    paragraphs.push(
      t(`analytics:behaviorNarrative.habits.postLoss.${context.postLossDominantCategory}`, {
        tab: t('analytics:postLossSizing.title'),
      }),
    );
  } else if (context.postLossSampleSize > 0) {
    paragraphs.push(t('analytics:behaviorNarrative.habits.postLoss.insufficient'));
  }

  if (
    context.postWinSampleSize >= BEHAVIOR_NARRATIVE_POST_SIZING_MIN_SAMPLE &&
    context.postWinDominantCategory
  ) {
    paragraphs.push(
      t(`analytics:behaviorNarrative.habits.postWin.${context.postWinDominantCategory}`, {
        tab: t('analytics:postWinSizing.title'),
      }),
    );
  }

  if (paragraphs.length === 0) return null;

  return {
    id: 'habits',
    titleKey: resolveSectionTitle('habits', context.tone),
    paragraphs,
    toneVariant: context.tone,
  };
}

function buildProcessSection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t, formatNumber } = input;
  const paragraphs: string[] = [];
  const tone = context.tone;

  if (context.tradesWithBothRr >= BEHAVIOR_NARRATIVE_MIN_PLANNED_RR_TRADES && context.planRespectRate != null) {
    const respectKey =
      context.planRespectRate >= 70
        ? 'analytics:behaviorNarrative.process.planRespectGood'
        : 'analytics:behaviorNarrative.process.planRespectLow';
    paragraphs.push(
      t(respectKey, {
        rate: formatNumber(context.planRespectRate, 0),
        comparableCount: context.tradesWithBothRr,
      }),
    );
  }

  if (
    context.tradesWithPlannedRr >= BEHAVIOR_NARRATIVE_MIN_PLANNED_RR_TRADES &&
    context.avgPlannedRr != null &&
    context.avgActualRr != null
  ) {
    paragraphs.push(
      t('analytics:behaviorNarrative.process.rrGap', {
        planned: formatNumber(context.avgPlannedRr, 2),
        actual: formatNumber(context.avgActualRr, 2),
      }),
    );
  }

  if (context.longPercentage != null && context.shortPercentage != null) {
    const dominant =
      context.longPercentage >= 75
        ? 'long'
        : context.shortPercentage >= 75
          ? 'short'
          : null;
    if (dominant) {
      paragraphs.push(
        t(`analytics:behaviorNarrative.process.bias${dominant === 'long' ? 'Long' : 'Short'}`, {
          longPct: formatNumber(context.longPercentage, 0),
          shortPct: formatNumber(context.shortPercentage, 0),
        }),
      );
    }
  }

  if (paragraphs.length === 0) return null;

  return {
    id: 'process',
    titleKey: resolveSectionTitle('process', tone),
    paragraphs,
    toneVariant: tone,
  };
}

function buildTrajectorySection(input: BuildBehaviorNarrativeInput): NarrativeSection | null {
  const { context, t, formatNumber, formatCurrency, currencySymbol } = input;
  const tone = context.tone;
  const monetary = context.monetaryNarrativesEnabled;
  const paragraphs: string[] = [];

  const eligibleWeeks = context.weekly.filter((w) => w.tradeCount >= BEHAVIOR_NARRATIVE_SWEET_SPOT_MIN_TRADES);
  if (monetary && eligibleWeeks.length > 0) {
    const bestWeek = [...eligibleWeeks].sort((a, b) => b.totalPnl - a.totalPnl)[0];
    const key = isCelebrateTone(tone)
      ? 'analytics:behaviorNarrative.trajectory.bestWeekCelebrate'
      : 'analytics:behaviorNarrative.trajectory.bestWeek';
    paragraphs.push(
      t(key, {
        week: bestWeek.isoWeek,
        year: bestWeek.isoYear,
        pnl: formatCurrency(bestWeek.totalPnl, currencySymbol),
        winRate: formatNumber(bestWeek.winRate, 0),
      }),
    );
  } else if (!monetary && eligibleWeeks.length > 0) {
    const bestWeek = [...eligibleWeeks].sort((a, b) => b.winRate - a.winRate)[0];
    paragraphs.push(
      t('analytics:behaviorNarrative.trajectory.bestWeekNoMoney', {
        week: bestWeek.isoWeek,
        year: bestWeek.isoYear,
        winRate: formatNumber(bestWeek.winRate, 0),
      }),
    );
  }

  if (context.trajectoryProgression) {
    const key = isCelebrateTone(tone)
      ? 'analytics:behaviorNarrative.trajectory.progressionCelebrate'
      : 'analytics:behaviorNarrative.trajectory.progression';
    paragraphs.push(t(key));
  } else if (context.trajectoryVolatile) {
    const key =
      tone === 'challenging'
        ? 'analytics:behaviorNarrative.trajectory.volatileEncourage'
        : 'analytics:behaviorNarrative.trajectory.volatile';
    paragraphs.push(t(key));
  }

  if (paragraphs.length === 0) return null;

  const trajectoryState = context.trajectoryProgression
    ? 'progression'
    : context.trajectoryVolatile
      ? 'volatile'
      : 'neutral';

  return {
    id: 'trajectory',
    titleKey: resolveSectionTitle('trajectory', tone, { trajectoryState }),
    paragraphs,
    toneVariant: tone,
  };
}

export function buildBehaviorNarrative(input: BuildBehaviorNarrativeInput): NarrativeSection[] {
  const { context, t } = input;

  if (context.tradeCount < BEHAVIOR_NARRATIVE_MIN_TRADES) {
    return [
      {
        id: 'intro',
        titleKey: 'behaviorNarrative.insufficientData.title',
        paragraphs: [
          t('analytics:behaviorNarrative.insufficientData.body', {
            min: BEHAVIOR_NARRATIVE_MIN_TRADES,
          }),
        ],
      },
    ];
  }

  const sections: NarrativeSection[] = [buildIntroSection(input)];

  const strengths = buildStrengthsSection(input);
  if (strengths) sections.push(strengths);

  const alerts = buildAlertsSection(input);
  if (alerts) sections.push(alerts);

  const risk = buildRiskSection(input);
  if (risk) sections.push(risk);

  const rhythm = buildRhythmSection(input);
  if (rhythm) sections.push(rhythm);

  const timeWindows = buildTimeWindowsSection(input);
  if (timeWindows) sections.push(timeWindows);

  const duration = buildDurationSection(input);
  if (duration) sections.push(duration);

  const habits = buildHabitsSection(input);
  if (habits) sections.push(habits);

  const process = buildProcessSection(input);
  if (process) sections.push(process);

  const trajectory = buildTrajectorySection(input);
  if (trajectory) sections.push(trajectory);

  if (sections.length === 1) {
    return [
      {
        id: 'intro',
        titleKey: 'behaviorNarrative.insufficientData.title',
        paragraphs: [t('analytics:behaviorNarrative.insufficientData.partial')],
      },
    ];
  }

  return sections;
}
