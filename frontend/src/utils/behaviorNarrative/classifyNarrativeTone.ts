import { GAUGE_CONFIGS } from '../../components/statistics/gaugeConfigs';
import { getGaugeVerdict } from '../getGaugeVerdict';
import type { BehaviorNarrativeContext, NarrativeTone } from './types';

export type { NarrativeTone };

export interface TrajectorySignals {
  progression: boolean;
  volatile: boolean;
}

export function computeTrajectorySignals(
  monthly: Array<{ month: string; pnl: number }>,
): TrajectorySignals {
  if (monthly.length < 2) {
    return { progression: false, volatile: false };
  }

  const midpoint = Math.floor(monthly.length / 2);
  const firstHalf = monthly.slice(0, midpoint);
  const secondHalf = monthly.slice(midpoint);
  const sumFirst = firstHalf.reduce((acc, m) => acc + m.pnl, 0);
  const sumSecond = secondHalf.reduce((acc, m) => acc + m.pnl, 0);

  return {
    progression: sumSecond > sumFirst && sumSecond > 0,
    volatile: sumSecond < sumFirst || monthly.some((m) => m.pnl < 0),
  };
}

type ToneInput = Pick<
  BehaviorNarrativeContext,
  | 'profitFactor'
  | 'sharpeAnnualized'
  | 'expectancy'
  | 'winRate'
  | 'maxDrawdownPct'
  | 'recoveryRatio'
  | 'revenge'
  | 'sizing'
  | 'trajectoryProgression'
  | 'trajectoryVolatile'
  | 'monetaryNarrativesEnabled'
>;

export function classifyNarrativeTone(input: ToneInput): NarrativeTone {
  let score = 0;

  if (input.profitFactor != null) {
    const verdict = getGaugeVerdict(input.profitFactor, GAUGE_CONFIGS.profitFactor);
    if (verdict === 'good') score += 2;
    else if (verdict === 'average') score += 1;
    else score -= 2;
  }

  if (input.sharpeAnnualized != null) {
    const verdict = getGaugeVerdict(input.sharpeAnnualized, GAUGE_CONFIGS.sharpeRatioAnnualized);
    if (verdict === 'good') {
      score += 2;
      if (input.sharpeAnnualized >= 2) score += 1;
    } else if (verdict === 'average') score += 1;
    else score -= 1;
  }

  if (input.winRate >= 55) score += 1;
  else if (input.winRate < 40) score -= 1;

  if (input.monetaryNarrativesEnabled) {
    if (input.maxDrawdownPct != null && input.maxDrawdownPct > 15) score -= 1;
    if (input.recoveryRatio != null) {
      if (input.recoveryRatio >= 1.5) score += 1;
      else if (input.recoveryRatio < 0.8) score -= 1;
    }
    if (input.expectancy > 0) score += 1;
    else if (input.expectancy < 0) score -= 1;
  }

  const revengeWarning = input.revenge?.alertLevel === 'warning';
  const sizingWarning = input.sizing?.alertLevel === 'warning';
  const alertCount = (revengeWarning ? 1 : 0) + (sizingWarning ? 1 : 0);

  const hasDisciplineData =
    (input.revenge?.hasSufficientData ?? false) || (input.sizing?.hasSufficientData ?? false);

  if (hasDisciplineData) {
    if (alertCount === 0) score += 1;
    else if (alertCount === 1) score -= 1;
    else score -= 2;
  }

  if (input.trajectoryProgression) score += 1;
  if (input.trajectoryVolatile) score -= 1;

  if (score >= 5) return 'excellent';
  if (score >= 2) return 'positive';
  if (score >= 0) return 'mixed';
  return 'challenging';
}
