import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StrategyComplianceStats } from '../../services/tradeStrategies';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDate } from '../../utils/dateFormat';
import Tooltip from '../ui/Tooltip';

const HEATMAP_DAYS = 28;

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildCalendarDays(periodEnd: string | null): Date[] {
  const end = periodEnd ? new Date(periodEnd + 'T12:00:00') : new Date();
  if (Number.isNaN(end.getTime())) {
    return [];
  }
  const days: Date[] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

interface StrategyStatsDisciplineOverviewCardProps {
  compliance: StrategyComplianceStats | null | undefined;
  periodEnd: string | null | undefined;
}

export const StrategyStatsDisciplineOverviewCard: React.FC<StrategyStatsDisciplineOverviewCardProps> = React.memo(
  ({ compliance, periodEnd }) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();

    const byDate = useMemo(() => {
      const m = new Map<string, StrategyComplianceStats['daily_compliance'][0]>();
      if (!compliance?.daily_compliance) return m;
      for (const row of compliance.daily_compliance) {
        m.set(row.date, row);
      }
      return m;
    }, [compliance]);

    const cells = useMemo(() => {
      const cal = buildCalendarDays(periodEnd ?? null);
      return cal.map((d) => {
        const key = toIsoDate(d);
        const row = byDate.get(key);
        const evaluated = row ? (row.respected || 0) + (row.not_respected || 0) : 0;
        let state: 'empty' | 'full' | 'none' | 'partial' = 'empty';
        if (row && evaluated > 0) {
          if ((row.not_respected || 0) === 0) state = 'full';
          else if ((row.respected || 0) === 0) state = 'none';
          else state = 'partial';
        }
        // T12:00:00 évite qu'une date ISO seule soit interprétée en UTC (décalage de jour selon le fuseau)
        const displayDate = formatDate(`${key}T12:00:00`, preferences.date_format, false, preferences.timezone);
        return { key, state, displayDate };
      });
    }, [byDate, periodEnd, preferences.date_format, preferences.timezone]);

    if (!compliance) {
      return null;
    }

    const { current_streak, best_streak, current_streak_start } = compliance;
    const streakStartFormatted =
      current_streak_start &&
      formatDate(
        /^\d{4}-\d{2}-\d{2}$/.test(current_streak_start)
          ? `${current_streak_start}T12:00:00`
          : current_streak_start,
        preferences.date_format,
        false,
        preferences.timezone
      );

    const cellClass = (state: (typeof cells)[0]['state']) => {
      switch (state) {
        case 'full':
          return 'bg-emerald-500 dark:bg-emerald-600';
        case 'partial':
          return 'bg-amber-400 dark:bg-amber-500';
        case 'none':
          return 'bg-rose-500 dark:bg-rose-600';
        default:
          return 'bg-gray-200 dark:bg-gray-600';
      }
    };

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-6 h-full flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {t('strategies:statsInsights.disciplineTitle')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('strategies:statsInsights.disciplineSubtitle')}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
              {t('strategies:statsInsights.currentStreak')}
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
              {current_streak}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                {t('strategies:statsInsights.streakDays')}
              </span>
            </div>
            {streakStartFormatted && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('strategies:statsInsights.since')} {streakStartFormatted}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
              {t('strategies:statsInsights.bestStreak')}
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
              {best_streak}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                {t('strategies:statsInsights.streakDays')}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('strategies:statsInsights.heatmapTitle')}
          </div>
          <div
            className="grid w-full grid-cols-7 gap-1 sm:gap-1.5"
            role="img"
            aria-label={t('strategies:statsInsights.heatmapAria')}
          >
            {cells.map((c) => (
              <Tooltip
                key={c.key}
                content={`${c.displayDate}: ${t(`strategies:statsInsights.heatmapState.${c.state}`)}`}
                position="top"
                delay={200}
                className="w-full min-w-0"
              >
                <div
                  className={`h-[26px] sm:h-[30px] w-full min-w-0 rounded-sm ${cellClass(c.state)}`}
                />
              </Tooltip>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
              {t('strategies:statsInsights.legendFull')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500" />
              {t('strategies:statsInsights.legendPartial')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-rose-500 dark:bg-rose-600" />
              {t('strategies:statsInsights.legendNone')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600" />
              {t('strategies:statsInsights.legendEmpty')}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

StrategyStatsDisciplineOverviewCard.displayName = 'StrategyStatsDisciplineOverviewCard';
