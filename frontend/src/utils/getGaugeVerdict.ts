import type { MetricGaugeConfig } from '../components/statistics/MetricGauge';

export type GaugeColor = 'red' | 'orange' | 'green';
export type GaugeVerdictLevel = 'poor' | 'average' | 'good';

export function getGaugeColor(value: number, config: MetricGaugeConfig): GaugeColor {
  const sortedThresholds = [...config.thresholds].sort((a, b) => a.value - b.value);

  for (let i = sortedThresholds.length - 1; i >= 0; i--) {
    if (value >= sortedThresholds[i].value) {
      return sortedThresholds[i].color;
    }
  }

  return sortedThresholds[0]?.color || 'red';
}

export function getGaugeVerdictLevel(color: GaugeColor): GaugeVerdictLevel {
  if (color === 'green') return 'good';
  if (color === 'orange') return 'average';
  return 'poor';
}

export function getGaugeVerdict(value: number, config: MetricGaugeConfig): GaugeVerdictLevel {
  return getGaugeVerdictLevel(getGaugeColor(value, config));
}

export function getExpectancyVerdict(expectancy: number): GaugeVerdictLevel {
  if (expectancy > 0) return 'good';
  if (expectancy === 0) return 'average';
  return 'poor';
}

export const VERDICT_CARD_CLASSES: Record<GaugeVerdictLevel, string> = {
  good: 'border-blue-200 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-900/20',
  average: 'border-orange-200 bg-orange-50/80 dark:border-orange-800 dark:bg-orange-900/20',
  poor: 'border-pink-200 bg-pink-50/80 dark:border-pink-800 dark:bg-pink-900/20',
};

export const VERDICT_TEXT_CLASSES: Record<GaugeVerdictLevel, string> = {
  good: 'text-blue-600 dark:text-blue-400',
  average: 'text-orange-600 dark:text-orange-400',
  poor: 'text-pink-600 dark:text-pink-400',
};

export const VERDICT_BADGE_CLASSES: Record<GaugeVerdictLevel, string> = {
  good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  average: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  poor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

export function verdictToMetricVariant(level: GaugeVerdictLevel): 'success' | 'warning' | 'danger' {
  if (level === 'good') return 'success';
  if (level === 'average') return 'warning';
  return 'danger';
}
