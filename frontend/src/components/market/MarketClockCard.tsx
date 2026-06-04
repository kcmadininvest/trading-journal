import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { getNextDSTChange, DSTEvent, MarketRegion } from '../../utils/dstCalculator';
import { getTimezoneOffsetFromUser } from '../../utils/timezoneCalculator';
import { MarketHoliday, MarketTodaySnapshot } from '../../services/calendar';
import { getMarketStatus, MarketStatus } from '../../utils/marketHours';
import {
  formatHolidayRelativeDate,
  isHolidayUrgent,
  sortUpcomingHolidays,
} from '../../utils/marketHolidayDisplay';
import { formatClockTime, type DateFormatType, type LanguageType } from '../../utils/dateFormat';
import { formatNumber, type NumberFormatType } from '../../utils/numberFormat';

export type ApiMarketCode = 'XNYS' | 'XPAR' | 'XLON' | 'XTKS';

interface MarketClockCardProps {
  marketCode: 'NYSE' | 'XPAR' | 'XLON' | 'XTKS';
  apiMarketCode: ApiMarketCode;
  marketName: string;
  flagCode: string;
  timezone: string;
  tradingHours: { open: string; close: string };
  color: 'blue' | 'purple' | 'red' | 'rose';
  holidays: MarketHoliday[];
  holidaysLoading: boolean;
  marketToday?: MarketTodaySnapshot;
  region: MarketRegion;
  userTimezone: string;
  showPreMarket?: boolean;
  maxUpcomingEvents?: number;
  language?: LanguageType;
  dateFormat?: DateFormatType;
  numberFormat?: NumberFormatType;
}

const colorClasses = {
  blue: { text: 'text-blue-600 dark:text-blue-300', headerBorder: 'border-blue-200 dark:border-blue-500/40' },
  purple: { text: 'text-purple-600 dark:text-purple-300', headerBorder: 'border-purple-200 dark:border-purple-500/40' },
  red: { text: 'text-red-600 dark:text-red-300', headerBorder: 'border-red-200 dark:border-red-500/40' },
  rose: { text: 'text-rose-600 dark:text-rose-300', headerBorder: 'border-rose-200 dark:border-rose-500/40' },
};

function MarketStatusPill({ status }: { status: MarketStatus }) {
  const { t } = useI18nTranslation();

  const isOpen = status === 'open';
  const isPreMarket = status === 'pre-market';

  const label = isOpen
    ? t('common:open', { defaultValue: 'Ouvert' })
    : isPreMarket
      ? t('common:marketHours.preMarket', { defaultValue: 'Pré-marché' })
      : t('common:closed', { defaultValue: 'Fermé' });

  return (
    <div
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 ${
        isOpen ? 'bg-emerald-500/10' : isPreMarket ? 'bg-amber-500/10' : 'bg-white/5'
      }`}
    >
      <span className={`relative flex h-1.5 w-1.5 ${status === 'closed' ? 'opacity-50' : ''}`}>
        {(isOpen || isPreMarket) && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              isOpen ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            isOpen ? 'bg-emerald-400' : isPreMarket ? 'bg-amber-400' : 'bg-white/30'
          }`}
        />
      </span>
      <span
        className={`text-[11px] font-semibold ${
          isOpen ? 'text-emerald-600 dark:text-emerald-400' : isPreMarket ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export const MarketClockCard: React.FC<MarketClockCardProps> = ({
  marketCode,
  apiMarketCode,
  flagCode,
  timezone,
  tradingHours,
  color,
  holidays,
  holidaysLoading,
  marketToday,
  region,
  userTimezone,
  showPreMarket,
  maxUpcomingEvents = 1,
  language = 'fr',
  dateFormat = 'EU',
  numberFormat = 'comma',
}) => {
  const { t, i18n } = useI18nTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dstEvent, setDstEvent] = useState<DSTEvent | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus>('closed');

  const locale = i18n.language?.split('-')[0] || 'fr';
  const classes = colorClasses[color];

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const event = getNextDSTChange(region);
    setDstEvent(event);
    const interval = setInterval(() => setDstEvent(getNextDSTChange(region)), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [region]);

  useEffect(() => {
    const now = currentTime;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const year = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10);
    const day = parseInt(parts.find((p) => p.type === 'day')?.value || '0', 10);

    const isWeekend = weekday === 'Sat' || weekday === 'Sun';
    const todayStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const isHolidayFromList =
      !holidaysLoading &&
      holidays.some(
        (h) => h.date === todayStr && h.market === apiMarketCode && h.type === 'holiday',
      );
    const holidayTodayFullDay = marketToday?.isFullDayHoliday;
    const isHoliday =
      holidayTodayFullDay !== undefined ? holidayTodayFullDay : isHolidayFromList;

    const sessionCloseLocal = marketToday?.sessionCloseLocal;
    const regularCloseOverride =
      !isHoliday && sessionCloseLocal ? sessionCloseLocal : undefined;

    const status = getMarketStatus(
      timezone,
      marketCode,
      now,
      isWeekend,
      isHoliday,
      showPreMarket || false,
      regularCloseOverride,
    );
    setMarketStatus(status);
  }, [
    currentTime,
    timezone,
    marketCode,
    apiMarketCode,
    holidays,
    holidaysLoading,
    marketToday,
    showPreMarket,
  ]);

  const formattedTime = useMemo(
    () => formatClockTime(currentTime, timezone, language),
    [timezone, currentTime, language],
  );

  const timezoneOffset = useMemo(
    () => getTimezoneOffsetFromUser(timezone, userTimezone, currentTime),
    [timezone, userTimezone, currentTime],
  );

  const upcomingEvents = useMemo(
    () => sortUpcomingHolidays(holidays, maxUpcomingEvents),
    [holidays, maxUpcomingEvents],
  );

  // Le Japon n'applique pas le DST — badge réservé aux fuseaux US/EU.
  const showDstBadge =
    timezone !== 'Asia/Tokyo' && dstEvent != null && dstEvent.daysUntil <= 7;
  const isDSTUrgent = dstEvent != null && dstEvent.daysUntil <= 2;

  const sessionClose = marketToday?.sessionCloseLocal ?? tradingHours.close;
  const showHolidaysSection = holidaysLoading || upcomingEvents.length > 0;

  const getMarketLabel = (code: string) => {
    switch (code) {
      case 'NYSE':
        return 'NYSE';
      case 'XPAR':
        return 'Euronext';
      case 'XLON':
        return 'LSE';
      case 'XTKS':
        return 'TSE';
      default:
        return code;
    }
  };

  const dstShortLabel = () => {
    if (!dstEvent) return '';
    const season =
      dstEvent.type === 'spring'
        ? t('common:dstChange.spring', { defaultValue: 'Été' }).split(' ')[0]
        : t('common:dstChange.fall', { defaultValue: 'Hiver' }).split(' ')[0];
    if (dstEvent.isToday) {
      return `${season} ${t('common:dstChange.today', { defaultValue: "Aujourd'hui" })}`;
    }
    if (dstEvent.isTomorrow) {
      return `${season} ${t('common:dstChange.tomorrow', { defaultValue: 'Demain' })}`;
    }
    return `${season} +${formatNumber(dstEvent.daysUntil, 0, numberFormat)}j`;
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div
        className={`flex items-center justify-between rounded-t-xl border-b bg-gray-50 px-2.5 py-1.5 dark:bg-gray-700/50 ${classes.headerBorder}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <img
            src={`https://flagcdn.com/16x12/${flagCode}.png`}
            srcSet={`https://flagcdn.com/32x24/${flagCode}.png 2x`}
            width="16"
            height="12"
            alt={flagCode.toUpperCase()}
            className="inline-block shrink-0"
          />
          <span className={`truncate text-xs font-bold uppercase tracking-wide ${classes.text}`}>
            {getMarketLabel(marketCode)}
          </span>
        </div>
        <MarketStatusPill status={marketStatus} />
      </div>

      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {timezoneOffset ? (
            <span className="shrink-0 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              UTC{timezoneOffset.formatted}
            </span>
          ) : null}
          <span className="text-lg font-bold tabular-nums leading-none text-gray-900 dark:text-gray-100">
            {formattedTime}
          </span>
          <span className="truncate text-xs text-gray-500 dark:text-gray-400">
            {tradingHours.open}–{sessionClose}
          </span>
        </div>
        {showDstBadge ? (
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
              isDSTUrgent
                ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                : 'border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400'
            }`}
          >
            {dstShortLabel()}
          </span>
        ) : null}
      </div>

      {marketToday?.isEarlyCloseDay && !marketToday.isFullDayHoliday ? (
        <div className="px-2.5 pb-1 text-[11px] font-medium text-amber-400">
          {t('common:marketHours.earlyClose', { defaultValue: 'Fermeture anticipée' })}
        </div>
      ) : null}

      {showHolidaysSection ? (
        <div className="mt-1 border-t border-gray-200 px-2.5 pt-1.5 pb-2 dark:border-gray-700">
          {holidaysLoading ? (
            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" aria-hidden />
          ) : (
            <ul className="space-y-0.5">
              {upcomingEvents.map((event) => {
                const urgent = isHolidayUrgent(event.date);
                const relativeDate = formatHolidayRelativeDate(
                  event.date,
                  t,
                  locale,
                  dateFormat,
                  numberFormat,
                );
                const isEarlyClose = event.type === 'early_close';

                return (
                  <li
                    key={`${event.market}-${event.date}-${event.name}`}
                    className={`flex min-h-[1.375rem] items-center gap-1 rounded px-0.5 ${
                      urgent
                        ? 'animate-pulse border border-amber-400/40 bg-amber-500/15'
                        : ''
                    }`}
                  >
                    {urgent ? (
                      <svg
                        className="h-2.5 w-2.5 shrink-0 text-amber-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                    {isEarlyClose ? (
                      <span className="shrink-0 text-[11px] font-bold text-gray-500 dark:text-gray-400" title={t('common:marketHours.earlyClose')}>
                        ½
                      </span>
                    ) : null}
                    <span
                      className={`min-w-0 flex-1 truncate text-xs ${
                        urgent ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {event.name}
                    </span>
                    <span
                      className={`shrink-0 text-xs ${
                        urgent ? 'font-medium text-amber-600 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {relativeDate}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default MarketClockCard;
