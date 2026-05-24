import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricCard, MetricItem } from './MetricCard';
import { AvgWinVsLossBarChart } from './AvgWinVsLossBarChart';
import { STATS_GRID } from './statisticsConstants';
import type { PointsStats, StatisticsTabBaseProps } from './statisticsTypes';
import type { ChartColors } from '../../utils/chartConfig';

interface StatisticsTradesTabProps extends StatisticsTabBaseProps {
  pointsStats: PointsStats | null;
  medianTradeCost: number;
  chartColors: ChartColors;
}

export const StatisticsTradesTab: React.FC<StatisticsTradesTabProps> = ({
  statisticsData,
  analyticsData,
  pointsStats,
  medianTradeCost,
  chartColors,
  currencySymbol,
  formatCurrency,
  formatNumber,
  hideMoney = false,
}) => {
  const { t } = useTranslation();

  const displayCurrency = (value: number) =>
    hideMoney ? '***' : formatCurrency(value, currencySymbol);

  return (
    <div className="space-y-4 sm:space-y-6">
      {analyticsData?.trade_stats && (
        <AvgWinVsLossBarChart
          avgWin={analyticsData.trade_stats.avg_winning_trade}
          avgLoss={analyticsData.trade_stats.avg_losing_trade}
          currencySymbol={currencySymbol}
          formatCurrency={formatCurrency}
          chartColors={chartColors}
          hideMoney={hideMoney}
        />
      )}

      <div className={STATS_GRID}>
        {pointsStats && (
          <MetricCard
            title={t('statistics:tradesAnalysis.avgPoints', { defaultValue: 'Points Moyens' })}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            }
          >
            <MetricItem
              label={t('statistics:tradesAnalysis.avgPointsPerTrade', { defaultValue: 'Moy. points / trade' })}
              value={`${pointsStats.avgPointsPerTrade >= 0 ? '+' : ''}${formatNumber(pointsStats.avgPointsPerTrade, 2)} pts`}
              tooltip={t('statistics:tradesAnalysis.avgPointsPerTradeTooltip', {
                defaultValue: 'Nombre moyen de points gagnés ou perdus par trade (indépendant de la taille de position)',
              })}
              variant={pointsStats.avgPointsPerTrade >= 0 ? 'success' : 'danger'}
            />
            <MetricItem
              label={t('statistics:tradesAnalysis.avgPointsWin', { defaultValue: 'Moy. points gagnants' })}
              value={pointsStats.avgPointsWin > 0 ? `+${formatNumber(pointsStats.avgPointsWin, 2)} pts` : 'N/A'}
              tooltip={t('statistics:tradesAnalysis.avgPointsWinTooltip', {
                defaultValue: 'Points moyens captés sur les trades gagnants',
              })}
              variant="success"
            />
            <MetricItem
              label={t('statistics:tradesAnalysis.avgPointsLoss', { defaultValue: 'Moy. points perdants' })}
              value={pointsStats.avgPointsLoss < 0 ? `${formatNumber(pointsStats.avgPointsLoss, 2)} pts` : 'N/A'}
              tooltip={t('statistics:tradesAnalysis.avgPointsLossTooltip', {
                defaultValue: 'Points moyens perdus sur les trades perdants',
              })}
              variant="danger"
            />
          </MetricCard>
        )}

        {pointsStats && (
          <MetricCard
            title={t('statistics:tradesAnalysis.extremePoints', { defaultValue: 'Points Extrêmes' })}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          >
            <MetricItem
              label={t('statistics:tradesAnalysis.maxPointsGain', { defaultValue: 'Max points gagnés' })}
              value={`+${formatNumber(pointsStats.maxPointsGain, 2)} pts`}
              variant="success"
            />
            <MetricItem
              label={t('statistics:tradesAnalysis.maxPointsLoss', { defaultValue: 'Max points perdus' })}
              value={`${formatNumber(pointsStats.maxPointsLoss, 2)} pts`}
              variant="danger"
            />
          </MetricCard>
        )}

        <MetricCard
          title={t('statistics:tradesAnalysis.averageAndMedianTradeCost')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:tradesAnalysis.averageCostPerTrade')}
            value={
              statisticsData.total_trades > 0
                ? displayCurrency(parseFloat(statisticsData.total_fees) / statisticsData.total_trades)
                : displayCurrency(0)
            }
            tooltip={t('statistics:tradesAnalysis.averageTradeCostTooltip')}
            variant="info"
          />
          <MetricItem
            label={t('statistics:tradesAnalysis.medianCostPerTrade', { defaultValue: 'Coût médian par trade' })}
            value={displayCurrency(medianTradeCost)}
            tooltip={t('statistics:tradesAnalysis.medianCostPerTradeTooltip', {
              defaultValue: 'Coût médian par trade (fees + commissions)',
            })}
            variant="info"
          />
        </MetricCard>

        {analyticsData?.trade_type_stats && (
          <MetricCard
            title={t('statistics:advancedAnalysis.longVsShort')}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            }
          >
            <MetricItem
              label={t('statistics:advancedAnalysis.longPercentage')}
              value={`${formatNumber(analyticsData.trade_type_stats.long_percentage, 1)}%`}
              variant="info"
            />
            <MetricItem
              label={t('statistics:advancedAnalysis.shortPercentage')}
              value={`${formatNumber(analyticsData.trade_type_stats.short_percentage, 1)}%`}
              variant="warning"
            />
          </MetricCard>
        )}
      </div>
    </div>
  );
};
