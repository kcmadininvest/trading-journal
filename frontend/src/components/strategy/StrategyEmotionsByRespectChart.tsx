import React from 'react';
import type { ChartOptions } from 'chart.js';
import { ChartSection } from '../common/ChartSection';
import { LazyChart } from './charts/LazyChart';
import { MemoizedBar as Bar } from './charts/MemoizedCharts';
import { STRATEGY_CHART_LAZY_FILL_HEIGHT } from '../../utils/chartConfig';

interface StrategyEmotionsByRespectChartProps {
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor: string;
      borderColor: string;
      borderWidth: number;
      borderRadius: number;
    }>;
    totalOccurrences: number;
  };
  options: ChartOptions<'bar'>;
  title: string;
  tooltip: string;
  totalLabel: string;
  formatNumber: (value: number, digits?: number) => string;
}

export const StrategyEmotionsByRespectChart: React.FC<StrategyEmotionsByRespectChartProps> = React.memo(
  ({ data, options, title, tooltip, totalLabel, formatNumber }) => {
    return (
      <ChartSection title={title} tooltip={tooltip} fillHeight className="h-full min-h-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-3 shrink-0 text-sm text-gray-600 dark:text-gray-400">
            {totalLabel}:{' '}
            <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {formatNumber(data.totalOccurrences, 0)}
            </span>
          </div>
          <LazyChart height={STRATEGY_CHART_LAZY_FILL_HEIGHT}>
            <Bar data={data} options={options} />
          </LazyChart>
        </div>
      </ChartSection>
    );
  }
);

StrategyEmotionsByRespectChart.displayName = 'StrategyEmotionsByRespectChart';
