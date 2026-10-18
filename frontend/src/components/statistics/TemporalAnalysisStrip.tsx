import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import { MetricGauge } from './MetricGauge';
import { GAUGE_CONFIGS } from './gaugeConfigs';

interface TemporalAnalysisStripProps {
  frequencyRatio: number;
  averageDuration: string;
  avgTimeBetweenTrades: string;
  avgDailyExposureTime: string;
  durationRatio: number;
  formatNumber: (value: number, digits?: number) => string;
}

export const TemporalAnalysisStrip: React.FC<TemporalAnalysisStripProps> = ({
  frequencyRatio,
  averageDuration,
  avgTimeBetweenTrades,
  avgDailyExposureTime,
  durationRatio,
  formatNumber,
}) => {
  const { t } = useTranslation();
  const hasDurationRatio = durationRatio > 0;
  const winnersLastLonger = durationRatio >= 1;

  const kpis = [
    {
      key: 'frequency',
      label: t('statistics:performanceRatios.frequency'),
      value: `${formatNumber(frequencyRatio, 1)} ${t('statistics:performanceRatios.tradesPerDay')}`,
      tooltip: t('statistics:performanceRatios.frequencyTooltip'),
    },
    {
      key: 'avgDuration',
      label: t('statistics:overview.averageDuration'),
      value: averageDuration || '00:00:00',
      tooltip: t('statistics:overview.averageDurationTooltip', {
        defaultValue:
          'Durée moyenne d’un trade sur la période filtrée (entrée → sortie), tous résultats confondus.',
      }),
    },
    {
      key: 'gap',
      label: t('statistics:performanceRatios.avgTimeBetweenTrades'),
      value: avgTimeBetweenTrades || '00:00:00',
      tooltip: t('statistics:performanceRatios.avgTimeBetweenTradesTooltip'),
    },
    {
      key: 'exposure',
      label: t('statistics:performanceRatios.avgDailyExposureTime'),
      value: avgDailyExposureTime || '00:00:00',
      tooltip: t('statistics:performanceRatios.avgDailyExposureTimeTooltip'),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      {hasDurationRatio ? (
        <MetricGauge
          label={t('statistics:performanceRatios.durationRatio')}
          value={durationRatio}
          config={GAUGE_CONFIGS.durationRatio}
          tooltip={t('statistics:performanceRatios.durationRatioTooltip')}
          formatValue={(val: number) => formatNumber(val, 2)}
          showLabels
          size="md"
        />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('statistics:overview.durationRatioEmpty', {
            defaultValue: 'Ratio de durée indisponible (données insuffisantes sur la période).',
          })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40"
          >
            <div className="flex items-center gap-1">
              <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">
                {kpi.label}
              </span>
              {kpi.tooltip && (
                <Tooltip
                  content={kpi.tooltip}
                  position="bottom"
                  className="shrink-0 items-center leading-none"
                  contentClassName="whitespace-pre-line block"
                >
                  <svg
                    className="block h-3.5 w-3.5 shrink-0 cursor-help text-gray-400 dark:text-gray-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Tooltip>
              )}
            </div>
            <span className="mt-0.5 block text-sm font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {hasDurationRatio && (
        <p
          className={
            winnersLastLonger
              ? 'mt-auto rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-100/90'
              : 'mt-auto rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100/90'
          }
        >
          {winnersLastLonger
            ? t('statistics:overview.durationRatioInsightGood', {
                defaultValue:
                  'Vos gagnants durent en moyenne {{ratio}}× plus longtemps que vos perdants — aligné avec laisser courir les gains.',
                ratio: formatNumber(durationRatio, 2),
              })
            : t('statistics:overview.durationRatioInsightWarn', {
                defaultValue:
                  'Vos perdants durent plus longtemps que vos gagnants (ratio {{ratio}}) — risque de couper les gains trop tôt ou de laisser courir les pertes.',
                ratio: formatNumber(durationRatio, 2),
              })}
        </p>
      )}
    </div>
  );
};
