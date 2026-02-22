import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency } from '../../utils/numberFormat';

interface HeatmapChartProps {
  data: {
    data: { [day: number]: { [hour: number]: number } };
    daysOfWeek: string[];
    maxAbs: number;
    minPnl: number;
    maxPnl: number;
    hoursWithData: number[];
  };
  currencySymbol: string;
  getHeatmapColor: (value: number, maxAbs: number) => string;
}

type HeatmapSlot = { dayIndex: number; hour: number; value: number };
interface HeatmapSummary {
  best: HeatmapSlot | null;
  worst: HeatmapSlot | null;
  activeSlots: number;
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  currencySymbol,
  getHeatmapColor,
}) => {
  const { t } = useTranslation();
  const heatmapContainerRef = useRef<HTMLDivElement>(null);
  const [heatmapTooltip, setHeatmapTooltip] = useState<{
    day: string;
    hour: number;
    value: number;
    x: number;
    y: number;
  } | null>(null);
  const hasData = Boolean(data && data.hoursWithData.length > 0);

  const summaryStats = useMemo<HeatmapSummary>(() => {
    if (!hasData || !data) {
      return { best: null, worst: null, activeSlots: 0 };
    }

    let best: HeatmapSlot | null = null;
    let worst: HeatmapSlot | null = null;
    let activeSlots = 0;

    data.daysOfWeek.forEach((_, dayIndex) => {
      data.hoursWithData.forEach((hour) => {
        const value = data.data[dayIndex][hour];
        if (value === undefined) return;
        if (value !== 0) activeSlots += 1;
        if (best === null || value > best.value) {
          best = { dayIndex, hour, value };
        }
        if (worst === null || value < worst.value) {
          worst = { dayIndex, hour, value };
        }
      });
    });

    return { best, worst, activeSlots };
  }, [data, hasData]);

  if (!hasData || !data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.heatmap.title')}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.heatmap.tooltip')}
          position="top"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>
      <div className="overflow-x-auto -mx-2 px-2">
        <div className="inline-block min-w-full">
          <div className="mb-2">
            <div className="flex ml-14">
              {data.hoursWithData.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 text-xs text-gray-600 dark:text-gray-400 text-center font-semibold min-w-[22px]"
                >
                  {hour.toString().padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1" ref={heatmapContainerRef}>
            {data.daysOfWeek.map((day, dayIndex) => (
              <div key={day} className="flex items-center">
                <div className="w-14 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right pr-2">
                  {day}
                </div>
                <div className="flex flex-1">
                  {data.hoursWithData.map((hour) => {
                    const value = data.data[dayIndex][hour];
                    const color = getHeatmapColor(value, data.maxAbs);
                    return (
                      <div
                        key={hour}
                        className="flex-1 h-7 border-2 border-white dark:border-gray-700 rounded-md hover:border-gray-300 dark:hover:border-gray-600 hover:scale-110 transition-all duration-200 cursor-pointer relative min-w-[22px] shadow-sm"
                        style={{ backgroundColor: color }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          
                          const tooltipWidth = 150;
                          const tooltipHeight = 70;
                          const padding = 8;
                          
                          let x = rect.left + rect.width / 2;
                          let y = rect.top - tooltipHeight - padding;
                          
                          const isFirstTwoRows = dayIndex <= 1;
                          if (isFirstTwoRows) {
                            y = rect.bottom + padding;
                          }
                          
                          const hourIndex = data.hoursWithData.indexOf(hour);
                          const isLastColumns = hourIndex >= data.hoursWithData.length - 3;
                          if (isLastColumns) {
                            x = rect.right - tooltipWidth;
                            if (x < padding) {
                              x = rect.left + rect.width / 2;
                            }
                          } else {
                            if (x - tooltipWidth / 2 < padding) {
                              x = tooltipWidth / 2 + padding;
                            } else if (x + tooltipWidth / 2 > window.innerWidth - padding) {
                              x = window.innerWidth - tooltipWidth / 2 - padding;
                            }
                          }
                          
                          if (y < padding) {
                            y = rect.bottom + padding;
                          }
                          if (y + tooltipHeight > window.innerHeight - padding) {
                            y = rect.top - tooltipHeight - padding;
                            if (y < padding) {
                              y = rect.bottom + padding;
                            }
                          }
                          
                          setHeatmapTooltip({
                            day,
                            hour,
                            value,
                            x: Math.max(padding, x),
                            y: Math.max(padding, y),
                          });
                        }}
                        onMouseLeave={() => {
                          setHeatmapTooltip(null);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {summaryStats.activeSlots > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>{t('analytics:charts.heatmap.summary.bestSlot')}</span>
              {summaryStats.best && (
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(summaryStats.best.value, currencySymbol)}
                </span>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>{t('analytics:charts.heatmap.summary.worstSlot')}</span>
              {summaryStats.worst && (
                <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">
                  {formatCurrency(summaryStats.worst.value, currencySymbol)}
                </span>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>{t('analytics:charts.heatmap.summary.activeSlots')}</span>
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {summaryStats.activeSlots}
              </span>
            </p>
          </div>
        </div>
      )}

      {heatmapTooltip && createPortal(
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 pointer-events-none"
          style={{
            left: `${heatmapTooltip.x}px`,
            top: `${heatmapTooltip.y}px`,
            transform: 'translate(-50%, 0)',
            width: '150px',
          }}
        >
          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
            {heatmapTooltip.day} - {heatmapTooltip.hour.toString().padStart(2, '0')}:00
          </div>
          <div className={`text-sm font-bold ${heatmapTooltip.value >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}`}>
            {formatCurrency(heatmapTooltip.value, currencySymbol)}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
