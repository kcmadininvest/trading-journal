import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface Market {
  id: string;
  name: string;
  shortName: string;
  timezone: string;
  flag: string;
  countryCode: string;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  preMarketHour?: number;
  preMarketMinute?: number;
  afterHoursHour?: number;
  afterHoursMinute?: number;
  color: string;
  weekdays: number[];
}

const MARKETS: Market[] = [
  {
    id: 'nyse',
    name: 'NYSE / NASDAQ',
    shortName: 'NYSE',
    timezone: 'America/New_York',
    flag: '🇺🇸',
    countryCode: 'us',
    openHour: 9,
    openMinute: 30,
    closeHour: 16,
    closeMinute: 0,
    preMarketHour: 4,
    preMarketMinute: 0,
    afterHoursHour: 20,
    afterHoursMinute: 0,
    color: 'blue',
    weekdays: [1, 2, 3, 4, 5],
  },
  {
    id: 'euronext',
    name: 'Euronext Paris',
    shortName: 'Paris',
    timezone: 'Europe/Paris',
    flag: '🇫🇷',
    countryCode: 'fr',
    openHour: 9,
    openMinute: 0,
    closeHour: 17,
    closeMinute: 30,
    color: 'purple',
    weekdays: [1, 2, 3, 4, 5],
  },
  {
    id: 'lse',
    name: 'London Stock Exchange',
    shortName: 'LSE',
    timezone: 'Europe/London',
    flag: '🇬🇧',
    countryCode: 'gb',
    openHour: 8,
    openMinute: 0,
    closeHour: 16,
    closeMinute: 30,
    color: 'red',
    weekdays: [1, 2, 3, 4, 5],
  },
  {
    id: 'tokyo',
    name: 'Tokyo Stock Exchange',
    shortName: 'Tokyo',
    timezone: 'Asia/Tokyo',
    flag: '🇯🇵',
    countryCode: 'jp',
    openHour: 9,
    openMinute: 0,
    closeHour: 15,
    closeMinute: 30,
    color: 'rose',
    weekdays: [1, 2, 3, 4, 5],
  },
];

type MarketStatus = 'open' | 'pre-market' | 'after-hours' | 'closed';

interface MarketInfo {
  market: Market;
  status: MarketStatus;
  localTime: string;
  localHour: number;
  localMinute: number;
  localDay: number;
  nextEventLabel: string;
  nextEventTime: string;
}

function getMarketInfo(market: Market, now: Date): MarketInfo {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: market.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minuteStr = parts.find(p => p.type === 'minute')?.value ?? '00';
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';

  const localHour = parseInt(hourStr, 10);
  const localMinute = parseInt(minuteStr, 10);
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const localDay = weekdayMap[weekdayStr] ?? 1;

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: market.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const localTime = timeFormatter.format(now);

  const currentMinutes = localHour * 60 + localMinute;
  const openMinutes = market.openHour * 60 + market.openMinute;
  const closeMinutes = market.closeHour * 60 + market.closeMinute;
  const preMarketMinutes = market.preMarketHour !== undefined
    ? market.preMarketHour * 60 + (market.preMarketMinute ?? 0)
    : null;
  const afterHoursMinutes = market.afterHoursHour !== undefined
    ? market.afterHoursHour * 60 + (market.afterHoursMinute ?? 0)
    : null;

  const isWeekday = market.weekdays.includes(localDay);

  let status: MarketStatus = 'closed';
  let nextEventLabel = '';
  let nextEventTime = '';

  if (!isWeekday) {
    status = 'closed';
    nextEventLabel = 'opensAt';
    nextEventTime = `${String(market.openHour).padStart(2, '0')}:${String(market.openMinute).padStart(2, '0')}`;
  } else if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    status = 'open';
    nextEventLabel = 'closesAt';
    nextEventTime = `${String(market.closeHour).padStart(2, '0')}:${String(market.closeMinute).padStart(2, '0')}`;
  } else if (preMarketMinutes !== null && currentMinutes >= preMarketMinutes && currentMinutes < openMinutes) {
    status = 'pre-market';
    nextEventLabel = 'opensAt';
    nextEventTime = `${String(market.openHour).padStart(2, '0')}:${String(market.openMinute).padStart(2, '0')}`;
  } else if (afterHoursMinutes !== null && currentMinutes >= closeMinutes && currentMinutes < afterHoursMinutes) {
    status = 'after-hours';
    nextEventLabel = 'closesAt';
    nextEventTime = `${String(market.afterHoursHour!).padStart(2, '0')}:${String(market.afterHoursMinute ?? 0).padStart(2, '0')}`;
  } else {
    status = 'closed';
    if (currentMinutes < openMinutes) {
      nextEventLabel = 'opensAt';
      nextEventTime = `${String(market.openHour).padStart(2, '0')}:${String(market.openMinute).padStart(2, '0')}`;
    } else {
      nextEventLabel = 'opensAt';
      nextEventTime = `${String(market.openHour).padStart(2, '0')}:${String(market.openMinute).padStart(2, '0')}`;
    }
  }

  return {
    market,
    status,
    localTime,
    localHour,
    localMinute,
    localDay,
    nextEventLabel,
    nextEventTime,
  };
}

const STATUS_STYLES: Record<MarketStatus, { dot: string; badge: string; text: string }> = {
  'open': {
    dot: 'bg-emerald-400 animate-pulse',
    badge: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  'pre-market': {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
    text: 'text-amber-700 dark:text-amber-400',
  },
  'after-hours': {
    dot: 'bg-orange-400',
    badge: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50',
    text: 'text-orange-700 dark:text-orange-400',
  },
  'closed': {
    dot: 'bg-gray-400 dark:bg-gray-600',
    badge: 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600/50',
    text: 'text-gray-500 dark:text-gray-400',
  },
};

interface MarketHoursWidgetProps {
  className?: string;
}

const MarketBadge: React.FC<{ info: MarketInfo }> = ({ info }) => {
  const { t } = useI18nTranslation();
  const [hovered, setHovered] = useState(false);
  const styles = STATUS_STYLES[info.status];

  const statusLabel =
    info.status === 'open'
      ? t('common:marketHours.open', { defaultValue: 'Ouvert' })
      : info.status === 'pre-market'
      ? t('common:marketHours.preMarket', { defaultValue: 'Pré-marché' })
      : info.status === 'after-hours'
      ? t('common:marketHours.afterHours', { defaultValue: 'After-hours' })
      : t('common:marketHours.closed', { defaultValue: 'Fermé' });

  const nextLabel =
    info.nextEventLabel === 'opensAt'
      ? t('common:marketHours.opensAt', { time: info.nextEventTime, defaultValue: `Ouvre à ${info.nextEventTime}` })
      : t('common:marketHours.closesAt', { time: info.nextEventTime, defaultValue: `Ferme à ${info.nextEventTime}` });

  const openStr = `${String(info.market.openHour).padStart(2, '0')}:${String(info.market.openMinute).padStart(2, '0')}`;
  const closeStr = `${String(info.market.closeHour).padStart(2, '0')}:${String(info.market.closeMinute).padStart(2, '0')}`;

  const statusColor =
    info.status === 'open'
      ? 'text-emerald-400'
      : info.status === 'pre-market'
      ? 'text-amber-400'
      : info.status === 'after-hours'
      ? 'text-orange-400'
      : 'text-gray-400';

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium cursor-default select-none transition-colors ${styles.badge}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${styles.dot}`} />
        <span className={`hidden sm:inline ${styles.text}`}>{info.market.flag}</span>
        <span className={`font-semibold ${styles.text}`}>{info.market.shortName}</span>
        <span className={`hidden md:inline ${styles.text} opacity-80`}>{info.localTime}</span>
      </div>

      {hovered && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
          <div className="w-2 h-2 bg-gray-900 border-t border-l border-gray-700 rotate-45 mx-auto -mb-1" />
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl px-3 py-2.5 text-left min-w-[170px]">
            <div className="font-semibold text-white text-xs mb-1">{info.market.name}</div>
            <div className="text-gray-400 text-xs mb-1.5">
              {t('common:marketHours.hours', {
                open: openStr,
                close: closeStr,
                defaultValue: `${openStr} – ${closeStr}`,
              })}
            </div>
            <div className={`text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </div>
            {info.nextEventLabel && (
              <div className="text-gray-400 text-xs mt-0.5">{nextLabel}</div>
            )}
            <div className="text-gray-600 text-xs mt-1.5 border-t border-gray-700 pt-1.5">
              {t('common:marketHours.localTime', { time: info.localTime, defaultValue: `Heure locale : ${info.localTime}` })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MarketHoursWidget: React.FC<MarketHoursWidgetProps> = ({ className = '' }) => {
  const [marketInfos, setMarketInfos] = useState<MarketInfo[]>([]);

  const update = useCallback(() => {
    const now = new Date();
    setMarketInfos(MARKETS.map(m => getMarketInfo(m, now)));
  }, []);

  useEffect(() => {
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [update]);

  if (marketInfos.length === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {marketInfos.map((info) => (
        <MarketBadge key={info.market.id} info={info} />
      ))}
    </div>
  );
};

export default MarketHoursWidget;
