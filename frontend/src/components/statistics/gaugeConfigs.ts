import { LARGER_PCT_THRESHOLDS } from '../../utils/postTradeSizingEvaluation';
import type { MetricGaugeConfig } from './MetricGauge';

export const GAUGE_CONFIGS: Record<string, MetricGaugeConfig> = {
  profitFactor: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 1.0, label: 'Average', color: 'orange' },
      { value: 2.0, label: 'Good', color: 'green' },
    ],
  },
  winRate: {
    type: 'percentage',
    min: 0,
    max: 100,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 40, label: 'Average', color: 'orange' },
      { value: 50, label: 'Good', color: 'green' },
    ],
    unit: '%',
  },
  sharpeRatio: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 0.5, label: 'Average', color: 'orange' },
      { value: 1.0, label: 'Good', color: 'green' },
    ],
  },
  /** Sharpe annualisé (√252) : < 0,5 faible · 0,5–1 moyen · ≥ 1 bon (≥ 2 excellent en sous-texte) */
  sharpeRatioAnnualized: {
    type: 'ratio',
    min: -2,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 0.5, label: 'Average', color: 'orange' },
      { value: 1.0, label: 'Good', color: 'green' },
    ],
  },
  tradeEfficiency: {
    type: 'percentage',
    min: 0,
    max: 100,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 30, label: 'Average', color: 'orange' },
      { value: 50, label: 'Good', color: 'green' },
    ],
    unit: '%',
  },
  feesRatio: {
    type: 'inverted-percentage',
    min: 0,
    max: 30,
    thresholds: [
      { value: 0, label: 'Good', color: 'green' },
      { value: 10, label: 'Average', color: 'orange' },
      { value: 20, label: 'Poor', color: 'red' },
    ],
    unit: '%',
  },
  winLossRatio: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 1.0, label: 'Average', color: 'orange' },
      { value: 1.5, label: 'Good', color: 'green' },
    ],
  },
  /** Recovery Factor = P/L net / Max Drawdown : < 1 faible · ≥ 1 correct · ≥ 2 bon · ≥ 3 excellent */
  recoveryFactor: {
    type: 'ratio',
    min: 0,
    max: 5,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 1.0, label: 'Average', color: 'orange' },
      { value: 2.0, label: 'Good', color: 'green' },
      { value: 3.0, label: 'Excellent', color: 'green' },
    ],
  },
  /** Meilleur trade / pire trade (absolus) */
  bestWorstTradeRatio: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 1.0, label: 'Average', color: 'orange' },
      { value: 1.5, label: 'Good', color: 'green' },
    ],
  },
  /** Durée moy. gagnants / durée moy. perdants : < 1 faible · ≥ 1 moyen · ≥ 1,5 bon */
  durationRatio: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 1.0, label: 'Average', color: 'orange' },
      { value: 1.5, label: 'Good', color: 'green' },
    ],
  },
  planRespectRate: {
    type: 'percentage',
    min: 0,
    max: 100,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 50, label: 'Average', color: 'orange' },
      { value: 70, label: 'Good', color: 'green' },
    ],
    unit: '%',
  },
  largerPctAfterTrade: {
    type: 'inverted-percentage',
    min: 0,
    max: 100,
    thresholds: [
      { value: 0, label: 'Good', color: 'green' },
      { value: LARGER_PCT_THRESHOLDS.goodMax, label: 'Average', color: 'orange' },
      { value: LARGER_PCT_THRESHOLDS.neutralMax, label: 'Poor', color: 'red' },
    ],
    unit: '%',
  },
};
