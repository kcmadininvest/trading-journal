import React, { useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { MarketHoliday } from '../../services/calendar';

interface MarketEventsTimelineProps {
  events: MarketHoliday[];
  maxEvents?: number;
  loading?: boolean;
}

export const MarketEventsTimeline: React.FC<MarketEventsTimelineProps> = ({
  events,
  maxEvents = 5,
  loading = false,
}) => {
  const { t, i18n } = useI18nTranslation();
  const currentLanguage = i18n.language?.split('-')[0] || 'fr';

  const sortedEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return events
      .filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, maxEvents);
  }, [events, maxEvents]);

  const getRelativeDate = (dateStr: string): string => {
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t('calendar:today', { defaultValue: "Aujourd'hui" });
    } else if (diffDays === 1) {
      return t('common:dstChange.tomorrow', { defaultValue: 'Demain' });
    } else if (diffDays <= 7) {
      return `${t('common:dstChange.in', { defaultValue: 'dans' })} ${diffDays} ${t('common:dstChange.days', { defaultValue: 'jours' })}`;
    } else {
      return eventDate.toLocaleDateString(currentLanguage, { month: 'short', day: 'numeric' });
    }
  };

  const isUrgent = (dateStr: string): boolean => {
    const eventDate = new Date(dateStr);
    eventDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= 2;
  };

  const getMarketColor = (market: string) => {
    switch (market) {
      case 'XNYS':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-700 dark:text-blue-300',
          border: 'border-blue-300 dark:border-blue-700',
        };
      case 'XPAR':
        return {
          bg: 'bg-purple-100 dark:bg-purple-900/30',
          text: 'text-purple-700 dark:text-purple-300',
          border: 'border-purple-300 dark:border-purple-700',
        };
      case 'XLON':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-700 dark:text-red-300',
          border: 'border-red-300 dark:border-red-700',
        };
      case 'XTKS':
        return {
          bg: 'bg-rose-100 dark:bg-rose-900/30',
          text: 'text-rose-700 dark:text-rose-300',
          border: 'border-rose-300 dark:border-rose-700',
        };
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-900/30',
          text: 'text-gray-700 dark:text-gray-300',
          border: 'border-gray-300 dark:border-gray-700',
        };
    }
  };

  const getMarketLabel = (market: string) => {
    switch (market) {
      case 'XNYS':
        return 'NYSE';
      case 'XPAR':
        return 'Euronext';
      case 'XLON':
        return 'London Stock Exchange';
      case 'XTKS':
        return 'Tokyo Stock Exchange';
      default:
        return market;
    }
  };

  const getFlagCode = (market: string) => {
    switch (market) {
      case 'XNYS':
        return 'us';
      case 'XPAR':
        return 'fr';
      case 'XLON':
        return 'gb';
      case 'XTKS':
        return 'jp';
      default:
        return 'us';
    }
  };

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-36 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse"
            style={{ height: '72px' }}
          />
        ))}
      </div>
    );
  }

  if (sortedEvents.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700" style={{ height: '72px' }}>
        {t('calendar:noUpcomingEvents', { defaultValue: 'Aucun événement à venir' })}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      {sortedEvents.map((event, index) => {
        const colors = getMarketColor(event.market);
        const urgent = isUrgent(event.date);
        
        return (
          <div
            key={`${event.market}-${event.date}-${index}`}
            className={`flex-shrink-0 flex flex-col justify-between p-1.5 rounded-lg border transition-all duration-300 hover:scale-102 hover:shadow-md ${
              urgent ? `${colors.bg} ${colors.border} animate-pulse` : `bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`
            }`}
            style={{ minWidth: '200px', maxWidth: '220px', height: '72px' }}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${colors.bg} ${colors.text} ${colors.border} border`}>
                <img
                  src={`https://flagcdn.com/16x12/${getFlagCode(event.market)}.png`}
                  srcSet={`https://flagcdn.com/32x24/${getFlagCode(event.market)}.png 2x`}
                  width="10"
                  height="8"
                  alt={getFlagCode(event.market).toUpperCase()}
                  className="inline-block"
                />
                {getMarketLabel(event.market)}
              </div>
              {urgent && (
                <svg className="w-2.5 h-2.5 text-amber-500 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            
            <div className="flex-1 mt-0.5">
              <div className={`text-xs font-medium leading-tight mb-0.5 line-clamp-2 ${urgent ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                {event.name}
              </div>
              <div className={`text-[10px] ${urgent ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                {getRelativeDate(event.date)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MarketEventsTimeline;
