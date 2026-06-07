import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { usePreferences } from '../../hooks/usePreferences';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';
import {
  ANALYTICS_CHART_BODY_CLASS,
  ANALYTICS_CHART_CARD_CLASS,
  ANALYTICS_SVG_CHART_MARGIN,
  CHART_FONT_FAMILY,
  computeAnalyticsSvgPlotMargins,
  getChartSvgFontSizes,
} from '../../utils/chartConfig';
import {
  computeDayTotalsByTrades,
  computeMaxCountByTrades,
  computeNiceYBounds,
  computeTradePnlDensityGrid,
  computeXTickValues,
  computeYTickValues,
  buildTradeSlots,
  densityIntensity,
  TRADE_COLUMN_FILL_RATIO,
  type DensityGridCell,
} from '../../utils/correlationDensityGrid';

interface CorrelationChartProps {
  data: {
    dataPoints: { trades: number; pnl: number }[];
    xTicks: number[];
    minTrades: number;
    maxTrades: number;
    regressionLine: { x: number; y: number }[];
    correlationCoefficient: number;
    rSquared: number;
  };
  currencySymbol: string;
  chartColors: {
    text: string;
    textSecondary: string;
    grid: string;
    border: string;
  };
}

const DENSITY_RGB = { light: '59, 130, 246', dark: '96, 165, 250' } as const;

type HoveredCell = DensityGridCell & { clientX: number; clientY: number };

export const CorrelationChart: React.FC<CorrelationChartProps> = ({
  data,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { preferences } = usePreferences();
  const chartFonts = useMemo(
    () => getChartSvgFontSizes(preferences.font_size),
    [preferences.font_size],
  );
  const clipPathId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<HoveredCell | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chartModel = useMemo(() => {
    if (!data?.dataPoints.length) {
      return null;
    }

    const points = data.dataPoints.map((d) => ({ x: d.trades, y: d.pnl }));
    const yValues = points.map((p) => p.y);
    if (data.regressionLine.length === 2) {
      yValues.push(data.regressionLine[0].y, data.regressionLine[1].y);
    }
    const { yMin, yMax } = computeNiceYBounds(yValues);
    const tradeSlots = buildTradeSlots(data.minTrades, data.maxTrades);
    const cells = computeTradePnlDensityGrid(
      points,
      { yMin, yMax, minTrades: data.minTrades, maxTrades: data.maxTrades },
    );

    return {
      cells,
      tradeSlots,
      maxCountByTrades: computeMaxCountByTrades(cells),
      dayTotalsByTrades: computeDayTotalsByTrades(points),
      yMin,
      yMax,
      xTicks: computeXTickValues(data.minTrades, data.maxTrades),
      yTicks: computeYTickValues(yMin, yMax, 5),
    };
  }, [data]);

  const margins = useMemo(() => {
    if (!chartModel) {
      return computeAnalyticsSvgPlotMargins({
        yTickLabels: [],
        tickFontSize: chartFonts.tick,
        bottom: ANALYTICS_SVG_CHART_MARGIN.bottomDenseX,
      });
    }

    const yLabels = chartModel.yTicks.map((tick) =>
      formatCurrency(tick, currencySymbol, preferences.number_format),
    );

    return computeAnalyticsSvgPlotMargins({
      yTickLabels: yLabels,
      tickFontSize: chartFonts.tick,
      bottom: ANALYTICS_SVG_CHART_MARGIN.bottomDenseX,
    });
  }, [chartModel, currencySymbol, preferences.number_format, chartFonts.tick]);

  const plotWidth = Math.max(size.width - margins.left - margins.right, 0);
  const plotHeight = Math.max(size.height - margins.top - margins.bottom, 0);

  const scales = useMemo(() => {
    if (!chartModel || plotWidth <= 0 || plotHeight <= 0 || chartModel.tradeSlots.length === 0) {
      return null;
    }
    const { tradeSlots, yMin, yMax } = chartModel;
    const slotWidth = plotWidth / tradeSlots.length;
    const columnWidthPx = slotWidth * TRADE_COLUMN_FILL_RATIO;
    const slotBase = tradeSlots[0];

    const xScaleTrades = (trades: number) => {
      const rounded = Math.round(trades);
      const index = rounded - slotBase;
      const clampedIndex = Math.max(0, Math.min(tradeSlots.length - 1, index));
      return margins.left + slotWidth * (clampedIndex + 0.5);
    };

    const yScale = (y: number) => margins.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;

    return { xScaleTrades, yScale, columnWidthPx, slotWidth };
  }, [chartModel, margins.left, margins.top, plotWidth, plotHeight]);

  const densityColor = useCallback(
    (count: number, maxInColumn: number) => {
      const alpha = densityIntensity(count, maxInColumn);
      const rgb = theme === 'dark' ? DENSITY_RGB.dark : DENSITY_RGB.light;
      return `rgba(${rgb}, ${alpha})`;
    },
    [theme],
  );

  const regressionStroke = theme === 'dark' ? '#e879f9' : '#c026d3';
  const cellHoverStroke = theme === 'dark' ? '#e2e8f0' : '#1e293b';

  const handleCellEnter = useCallback((cell: DensityGridCell, event: React.MouseEvent) => {
    setHovered({
      ...cell,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, []);

  const handleCellLeave = useCallback(() => {
    setHovered(null);
  }, []);

  if (!data || data.dataPoints.length === 0) {
    return (
      <div className={ANALYTICS_CHART_CARD_CLASS}>
        <div className="flex items-center justify-center h-[450px]">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={ANALYTICS_CHART_CARD_CLASS}>
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3" />
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.correlation.title')}
        </h3>
        {data.dataPoints.length > 1 && (
          <>
            <span className="ml-3 text-sm font-normal text-gray-600 dark:text-gray-400">
              (R² = {formatNumber(data.rSquared, 3, preferences.number_format)})
            </span>
            <TooltipComponent
              content={t('analytics:charts.correlation.rSquaredTooltip')}
              position="top"
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
                <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </TooltipComponent>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-3 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span>{t('analytics:charts.correlation.densityLegend')}</span>
          <div
            className="h-2.5 w-20 rounded-full"
            style={{
              background: theme === 'dark'
                ? `linear-gradient(90deg, rgba(${DENSITY_RGB.dark}, 0.25), rgba(${DENSITY_RGB.dark}, 1))`
                : `linear-gradient(90deg, rgba(${DENSITY_RGB.light}, 0.25), rgba(${DENSITY_RGB.light}, 1))`,
            }}
          />
        </div>
        {data.regressionLine.length > 0 && (
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-6 border-t-2"
              style={{ borderColor: regressionStroke }}
            />
            <span>{t('analytics:charts.correlation.regressionLine')}</span>
          </div>
        )}
      </div>

      <div ref={containerRef} className={ANALYTICS_CHART_BODY_CLASS}>
        {size.width > 0 && size.height > 0 && chartModel && scales && (
          <svg
            width={size.width}
            height={size.height}
            role="img"
            aria-label={t('analytics:charts.correlation.title')}
          >
            {chartModel.yTicks.map((tick) => {
              const y = scales.yScale(tick);
              return (
                <line
                  key={`y-grid-${tick}`}
                  x1={margins.left}
                  x2={margins.left + plotWidth}
                  y1={y}
                  y2={y}
                  stroke={chartColors.grid}
                  strokeWidth={1}
                />
              );
            })}

            {chartModel.tradeSlots.map((tick) => {
              const x = scales.xScaleTrades(tick);
              return (
                <line
                  key={`x-grid-${tick}`}
                  x1={x}
                  x2={x}
                  y1={margins.top}
                  y2={margins.top + plotHeight}
                  stroke={chartColors.grid}
                  strokeWidth={1}
                />
              );
            })}

            <defs>
              <clipPath id={clipPathId}>
                <rect
                  x={margins.left}
                  y={margins.top}
                  width={plotWidth}
                  height={plotHeight}
                />
              </clipPath>
            </defs>

            <g clipPath={`url(#${clipPathId})`}>
              {chartModel.cells.map((cell) => {
                const cx = scales.xScaleTrades(cell.trades);
                const halfW = scales.columnWidthPx / 2;
                const top = scales.yScale(cell.yMax);
                const height = Math.max(scales.yScale(cell.yMin) - top, 1);
                const isHovered =
                  hovered?.trades === cell.trades
                  && hovered?.yMin === cell.yMin
                  && hovered?.yMax === cell.yMax;

                return (
                  <rect
                    key={`${cell.trades}-${cell.yMin}`}
                    x={cx - halfW}
                    y={top}
                    width={scales.columnWidthPx}
                    height={height}
                    rx={2}
                    fill={densityColor(
                      cell.count,
                      chartModel.maxCountByTrades.get(cell.trades) ?? 1,
                    )}
                    stroke={isHovered ? cellHoverStroke : 'transparent'}
                    strokeWidth={isHovered ? 1.5 : 0}
                    onMouseEnter={(e) => handleCellEnter(cell, e)}
                    onMouseLeave={handleCellLeave}
                  />
                );
              })}

            </g>

            <g clipPath={`url(#${clipPathId})`} pointerEvents="none">
              {data.regressionLine.length === 2 && (
                <line
                  x1={scales.xScaleTrades(data.regressionLine[0].x)}
                  y1={scales.yScale(data.regressionLine[0].y)}
                  x2={scales.xScaleTrades(data.regressionLine[1].x)}
                  y2={scales.yScale(data.regressionLine[1].y)}
                  stroke={regressionStroke}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              )}
            </g>

            <line
              x1={margins.left}
              x2={margins.left + plotWidth}
              y1={margins.top + plotHeight}
              y2={margins.top + plotHeight}
              stroke={chartColors.border}
            />
            <line
              x1={margins.left}
              x2={margins.left}
              y1={margins.top}
              y2={margins.top + plotHeight}
              stroke={chartColors.border}
            />

            {chartModel.xTicks.map((tick) => {
              const dayTotal = chartModel.dayTotalsByTrades.get(tick) ?? 0;
              return (
                <g key={`x-label-${tick}`}>
                  <text
                    x={scales.xScaleTrades(tick)}
                    y={margins.top + plotHeight + 20}
                    textAnchor="middle"
                    fill={chartColors.textSecondary}
                    fontFamily={CHART_FONT_FAMILY}
                    fontSize={chartFonts.tick}
                  >
                    {formatNumber(tick, 0, preferences.number_format)}
                  </text>
                  {dayTotal > 0 && (
                    <text
                      x={scales.xScaleTrades(tick)}
                      y={margins.top + plotHeight + 34}
                      textAnchor="middle"
                      fill={chartColors.textSecondary}
                      fontFamily={CHART_FONT_FAMILY}
                      fontSize={chartFonts.caption}
                      opacity={0.75}
                    >
                      {t('analytics:charts.correlation.columnDayCount', {
                        formattedCount: formatNumber(dayTotal, 0, preferences.number_format),
                      })}
                    </text>
                  )}
                </g>
              );
            })}
            <text
              x={margins.left + plotWidth / 2}
              y={size.height - 6}
              textAnchor="middle"
              fill={chartColors.text}
              fontFamily={CHART_FONT_FAMILY}
              fontSize={chartFonts.axis}
              fontWeight={600}
            >
              {t('analytics:charts.correlation.xAxis')}
            </text>

            {chartModel.yTicks.map((tick) => (
              <text
                key={`y-label-${tick}`}
                x={margins.left - ANALYTICS_SVG_CHART_MARGIN.tickGap}
                y={scales.yScale(tick) + 4}
                textAnchor="end"
                fill={chartColors.textSecondary}
                fontFamily={CHART_FONT_FAMILY}
                fontSize={chartFonts.tick}
              >
                {formatCurrency(tick, currencySymbol, preferences.number_format)}
              </text>
            ))}
          </svg>
        )}

        {hovered && (
          <div
            className="pointer-events-none fixed z-50 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-lg"
            style={{
              left: hovered.clientX + 12,
              top: hovered.clientY + 12,
            }}
          >
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              {t('analytics:charts.correlation.densityTooltip.tradesPerDay', {
                count: hovered.trades,
                formattedCount: formatNumber(hovered.trades, 0, preferences.number_format),
              })}
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              {t('analytics:charts.correlation.hexbinTooltip.days', {
                count: hovered.count,
                formattedCount: formatNumber(hovered.count, 0, preferences.number_format),
              })}
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              {t('analytics:charts.correlation.hexbinTooltip.avgPnl', {
                value: formatCurrency(hovered.avgPnl, currencySymbol, preferences.number_format),
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
