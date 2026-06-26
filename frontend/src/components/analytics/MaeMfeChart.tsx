import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import { ChartHoverTooltip } from '../charts/ChartHoverTooltip';
import { rechartsTooltipWrapperProps } from '../charts/rechartsTooltipWrapperProps';
import { ChartTooltipResetContainer } from '../charts/ChartTooltipResetContainer';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';
import { usePreferences } from '../../hooks/usePreferences';
import { CHART_FONT_FAMILY, ANALYTICS_CHART_BODY_CLASS, ANALYTICS_CHART_CARD_CLASS, type ChartColors } from '../../utils/chartConfig';

interface MaeMfeDataPoint {
  tradeId: number;
  contractName: string;
  tradeType: 'Long' | 'Short';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  mae: number;
  mfe: number;
  tradeDay: string;
}

interface MaeMfeChartProps {
  data: MaeMfeDataPoint[];
  currencySymbol: string;
  chartColors: ChartColors;
  tradesCount: number;
}

interface MaeMfeCluster {
  mae: number;
  mfe: number;
  trades: number;
  winRate: number;
  z: number;
}

const WINNING_COLOR = '#3b82f6';
const LOSING_COLOR = '#ec4899';
const BUBBLE_OPACITY = 0.6;

function clusterRadius(trades: number): number {
  return Math.max(5, Math.min(38, Math.sqrt(trades) * 2));
}

/** Regroupe les trades en cellules MAE/MFE pour visualiser la densité. */
function clusterMaeMfeData(data: MaeMfeDataPoint[]): {
  winningClusters: MaeMfeCluster[];
  losingClusters: MaeMfeCluster[];
} {
  if (data.length === 0) {
    return { winningClusters: [], losingClusters: [] };
  }

  const points = data.map((d) => ({
    mae: Math.abs(d.mae),
    mfe: d.mfe,
    isWin: d.pnl > 0,
  }));

  const maes = points.map((p) => p.mae);
  const mfes = points.map((p) => p.mfe);
  const maeMin = Math.min(...maes);
  const maeMax = Math.max(...maes);
  const mfeMin = Math.min(...mfes);
  const mfeMax = Math.max(...mfes);

  const bins = Math.min(12, Math.max(6, Math.round(Math.sqrt(points.length / 3))));
  const maeSpan = maeMax - maeMin || 1;
  const mfeSpan = mfeMax - mfeMin || 1;
  const maeStep = maeSpan / bins;
  const mfeStep = mfeSpan / bins;

  const cells = new Map<string, { maeSum: number; mfeSum: number; count: number; wins: number }>();

  for (const point of points) {
    const maeBin = Math.min(bins - 1, Math.floor((point.mae - maeMin) / maeStep));
    const mfeBin = Math.min(bins - 1, Math.floor((point.mfe - mfeMin) / mfeStep));
    const key = `${maeBin}:${mfeBin}`;
    const cell = cells.get(key) ?? { maeSum: 0, mfeSum: 0, count: 0, wins: 0 };
    cell.maeSum += point.mae;
    cell.mfeSum += point.mfe;
    cell.count += 1;
    if (point.isWin) {
      cell.wins += 1;
    }
    cells.set(key, cell);
  }

  const winningClusters: MaeMfeCluster[] = [];
  const losingClusters: MaeMfeCluster[] = [];

  for (const cell of Array.from(cells.values())) {
    const cluster: MaeMfeCluster = {
      mae: cell.maeSum / cell.count,
      mfe: cell.mfeSum / cell.count,
      trades: cell.count,
      winRate: (cell.wins / cell.count) * 100,
      z: cell.count,
    };
    if (cluster.winRate >= 50) {
      winningClusters.push(cluster);
    } else {
      losingClusters.push(cluster);
    }
  }

  return { winningClusters, losingClusters };
}

function MaeMfeBubble(props: {
  cx?: number;
  cy?: number;
  payload?: MaeMfeCluster;
  fill: string;
}) {
  const { cx, cy, payload, fill } = props;
  if (cx == null || cy == null || !payload) {
    return null;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={clusterRadius(payload.trades)}
      fill={fill}
      fillOpacity={BUBBLE_OPACITY}
      stroke={fill}
      strokeOpacity={0.85}
      strokeWidth={1}
    />
  );
}

export const MaeMfeChart: React.FC<MaeMfeChartProps> = ({
  data,
  currencySymbol,
  chartColors,
  tradesCount,
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const numberFormat = preferences.number_format ?? 'comma';

  const { winningClusters, losingClusters } = useMemo(() => clusterMaeMfeData(data), [data]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) {
      return undefined;
    }

    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      const w = Math.floor(width);
      const h = Math.floor(height);
      if (w > 0 && h > 0) {
        setChartSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [data.length]);

  const axisTickStyle = useMemo(
    () => ({
      fontSize: 11,
      fill: chartColors.textSecondary,
      fontFamily: CHART_FONT_FAMILY,
    }),
    [chartColors.textSecondary],
  );

  const axisLabelStyle = useMemo(
    () => ({
      fontSize: 12,
      fill: chartColors.text,
      fontFamily: CHART_FONT_FAMILY,
      fontWeight: 600,
    }),
    [chartColors.text],
  );

  const formatAxisCurrency = (value: number) =>
    formatCurrency(value, currencySymbol, numberFormat, 0);

  return (
    <div className={ANALYTICS_CHART_CARD_CLASS}>
      <div className="mb-3 flex-shrink-0">
        <div className="flex items-start gap-2">
          <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full mr-1 mt-1 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 leading-snug">
                {t('analytics:charts.maeMfe.title', {
                  defaultValue: 'Maximum Adverse Excursion vs Maximum Favorable Excursion',
                })}
              </h3>
              <ChartHelpTooltip
                content={t('analytics:charts.maeMfe.tooltip', {
                  defaultValue:
                    'Analyse du Maximum Adverse Excursion (pire mouvement contre vous) vs Maximum Favorable Excursion (meilleur mouvement pour vous). Les points en haut à gauche indiquent des trades bien gérés (faible MAE, fort MFE).',
                })}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              {t('analytics:charts.maeMfe.description', {
                defaultValue:
                  'Le MAE mesure le pire mouvement contre vous pendant un trade ; le MFE, le meilleur mouvement en votre faveur. Les bulles regroupent des trades proches.',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-600 dark:text-gray-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: WINNING_COLOR, opacity: BUBBLE_OPACITY }} />
            {t('analytics:charts.maeMfe.winningTrades', { defaultValue: 'Trades gagnants' })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: LOSING_COLOR, opacity: BUBBLE_OPACITY }} />
            {t('analytics:charts.maeMfe.losingTrades', { defaultValue: 'Trades perdants' })}
          </span>
        </div>
      </div>

      <ChartTooltipResetContainer className={ANALYTICS_CHART_BODY_CLASS}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="text-sm">
                {t('analytics:charts.maeMfe.noData', {
                  defaultValue: 'Aucune donnée MAE/MFE disponible pour cette période',
                })}
              </p>
              {tradesCount === 0 && (
                <p className="text-xs mt-2 text-gray-400 dark:text-gray-500">
                  {t('analytics:noTrades', { defaultValue: 'Aucun trade trouvé' })}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={chartContainerRef}
            className="min-w-0 h-full w-full [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-surface]:focus:outline-none [&_.recharts-surface]:focus-visible:outline-none"
            onMouseDown={(event) => event.preventDefault()}
          >
            {chartSize.width > 0 && chartSize.height > 0 && (
              <ResponsiveContainer width={chartSize.width} height={chartSize.height} minWidth={0}>
                <ScatterChart
                  accessibilityLayer={false}
                  style={{ outline: 'none' }}
                  margin={{ top: 8, right: 12, bottom: 20, left: 0 }}
                >
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="mae"
                    name={t('analytics:charts.maeMfe.mae', { defaultValue: 'MAE' })}
                    tick={axisTickStyle}
                    tickFormatter={formatAxisCurrency}
                    tickMargin={4}
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: t('analytics:charts.maeMfe.mae', { defaultValue: 'MAE' }),
                      position: 'bottom',
                      offset: 0,
                      style: axisLabelStyle,
                    }}
                    stroke={chartColors.border}
                  />
                  <YAxis
                    type="number"
                    dataKey="mfe"
                    name={t('analytics:charts.maeMfe.mfe', { defaultValue: 'MFE' })}
                    tick={axisTickStyle}
                    tickFormatter={formatAxisCurrency}
                    width={72}
                    tickMargin={4}
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: t('analytics:charts.maeMfe.mfe', { defaultValue: 'MFE' }),
                      angle: -90,
                      position: 'insideLeft',
                      offset: 12,
                      style: { ...axisLabelStyle, textAnchor: 'middle' },
                    }}
                    stroke={chartColors.border}
                  />
                  <Tooltip
                    {...rechartsTooltipWrapperProps}
                    cursor={false}
                    trigger="hover"
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }
                      const cluster = payload[0].payload as MaeMfeCluster;
                      return (
                        <ChartHoverTooltip
                          chartColors={chartColors}
                          title={t('analytics:charts.maeMfe.clusterTitle', {
                            defaultValue: 'Zone MAE / MFE',
                          })}
                          lines={[
                            `${t('analytics:charts.maeMfe.mae', { defaultValue: 'MAE' })}: ${formatCurrency(cluster.mae, currencySymbol, numberFormat)}`,
                            `${t('analytics:charts.maeMfe.mfe', { defaultValue: 'MFE' })}: ${formatCurrency(cluster.mfe, currencySymbol, numberFormat)}`,
                            `${t('analytics:charts.maeMfe.trades', { defaultValue: 'Trades' })}: ${formatNumber(cluster.trades, 0, numberFormat)}`,
                            `${t('analytics:charts.maeMfe.winRate', { defaultValue: 'Win rate' })}: ${formatNumber(cluster.winRate, 0, numberFormat)}%`,
                          ]}
                        />
                      );
                    }}
                  />
                  <Scatter
                    name={t('analytics:charts.maeMfe.winningTrades', { defaultValue: 'Trades gagnants' })}
                    data={winningClusters}
                    fill={WINNING_COLOR}
                    isAnimationActive={false}
                    activeShape={false}
                    shape={(props: { cx?: number; cy?: number; payload?: MaeMfeCluster }) => (
                      <MaeMfeBubble {...props} fill={WINNING_COLOR} />
                    )}
                  />
                  <Scatter
                    name={t('analytics:charts.maeMfe.losingTrades', { defaultValue: 'Trades perdants' })}
                    data={losingClusters}
                    fill={LOSING_COLOR}
                    isAnimationActive={false}
                    activeShape={false}
                    shape={(props: { cx?: number; cy?: number; payload?: MaeMfeCluster }) => (
                      <MaeMfeBubble {...props} fill={LOSING_COLOR} />
                    )}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </ChartTooltipResetContainer>
    </div>
  );
};
