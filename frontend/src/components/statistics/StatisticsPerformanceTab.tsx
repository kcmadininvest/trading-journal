import React from 'react';
import {
  RadarChart,
  createRadarAlternatingZonesPlugin,
  createRadarGradientPlugin,
} from '../analytics';
import { PerformanceEdgeKpiStrip } from './PerformanceEdgeKpiStrip';
import { PerformanceDetailsGrid } from './PerformanceDetailsGrid';
import type { StatisticsTabBaseProps } from './statisticsTypes';
import type { ChartColors } from '../../utils/chartConfig';

interface StatisticsPerformanceTabProps extends StatisticsTabBaseProps {
  chartColors: ChartColors;
}

export const StatisticsPerformanceTab: React.FC<StatisticsPerformanceTabProps> = ({
  statisticsData,
  currencySymbol,
  formatCurrency,
  formatNumber,
  formatRatio,
  hideMoney = false,
  chartColors,
}) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PerformanceEdgeKpiStrip
        statisticsData={statisticsData}
        currencySymbol={currencySymbol}
        formatCurrency={formatCurrency}
        formatNumber={formatNumber}
        hideMoney={hideMoney}
      />

      <RadarChart
        data={null}
        statisticsData={statisticsData}
        currencySymbol={currencySymbol}
        createRadarAlternatingZonesPlugin={createRadarAlternatingZonesPlugin}
        createRadarGradientPlugin={createRadarGradientPlugin}
        chartColors={chartColors}
        variant="compact"
      />

      <PerformanceDetailsGrid
        statisticsData={statisticsData}
        formatNumber={formatNumber}
        formatRatio={formatRatio}
      />
    </div>
  );
};
