import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../hooks/useTheme';
import { SessionEventItem } from '../../services/sessionReplay';
import { formatTime } from '../../utils/dateFormat';
import { formatCurrencyWithSign, NumberFormatType } from '../../utils/numberFormat';
import { buildPnlChartPoints } from './pnlChartData';
import { replayPanelClass } from './replayStyles';

interface SessionPnlChartProps {
  events: SessionEventItem[];
  currentIndex: number;
  timezone?: string;
  language?: string;
  numberFormat?: NumberFormatType;
}

interface ChartRow {
  seq: number;
  eventIndex: number;
  pnl: number;
  timeLabel: string;
}

export const SessionPnlChart: React.FC<SessionPnlChartProps> = ({
  events,
  currentIndex,
  timezone = 'Europe/Paris',
  language = 'fr',
  numberFormat = 'comma',
}) => {
  const { t } = useTranslation('replay');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartRows = useMemo((): ChartRow[] => {
    return buildPnlChartPoints(events, currentIndex).map((pt, seq) => ({
      seq,
      eventIndex: pt.eventIndex,
      pnl: pt.pnl,
      timeLabel: pt.occurredAt
        ? formatTime(pt.occurredAt, timezone, language as 'fr')
        : '',
    }));
  }, [events, currentIndex, timezone, language]);

  const lastPnl = chartRows.length > 0 ? chartRows[chartRows.length - 1].pnl : 0;
  const activeRow = chartRows.length > 0 ? chartRows[chartRows.length - 1] : null;

  const strokeColor = lastPnl >= 0 ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#f87171' : '#dc2626');
  const fillColor = lastPnl >= 0
    ? (isDark ? 'rgba(74, 222, 128, 0.2)' : 'rgba(22, 163, 74, 0.15)')
    : (isDark ? 'rgba(248, 113, 113, 0.2)' : 'rgba(220, 38, 38, 0.15)');

  const axisColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  if (events.length === 0) {
    return null;
  }

  return (
    <div className={`${replayPanelClass} !p-3`}>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {t('pnlChartTitle')}
      </h3>
      {chartRows.length < 1 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">
          {t('pnlChartInsufficient')}
        </p>
      ) : (
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="seq"
                tick={{ fontSize: 10, fill: axisColor }}
                interval="preserveStartEnd"
                minTickGap={28}
                tickFormatter={(seq) => chartRows[Number(seq)]?.timeLabel ?? ''}
              />
              <YAxis
                tick={{ fontSize: 10, fill: axisColor }}
                width={48}
                tickFormatter={(v) =>
                  formatCurrencyWithSign(Number(v), '', numberFormat, 0).replace(/\s/g, '')
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as ChartRow;
                  return (
                    <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs shadow-md">
                      <p className="text-gray-500 dark:text-gray-400">{row.timeLabel}</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrencyWithSign(row.pnl, '', numberFormat, 2)}
                      </p>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke={axisColor} strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={strokeColor}
                fill={fillColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {activeRow && (
                <ReferenceDot
                  x={activeRow.seq}
                  y={activeRow.pnl}
                  r={4}
                  fill={strokeColor}
                  stroke={isDark ? '#1f2937' : '#ffffff'}
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
