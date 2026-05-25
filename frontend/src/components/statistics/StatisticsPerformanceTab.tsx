import React from 'react';
import { PerformanceEdgeKpiStrip } from './PerformanceEdgeKpiStrip';
import { PerformanceDetailsGrid } from './PerformanceDetailsGrid';
import type { StatisticsTabBaseProps } from './statisticsTypes';

export const StatisticsPerformanceTab: React.FC<StatisticsTabBaseProps> = ({
  statisticsData,
  currencySymbol,
  formatCurrency,
  formatNumber,
  formatRatio,
  hideMoney = false,
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

      <PerformanceDetailsGrid
        statisticsData={statisticsData}
        formatNumber={formatNumber}
        formatRatio={formatRatio}
      />
    </div>
  );
};
