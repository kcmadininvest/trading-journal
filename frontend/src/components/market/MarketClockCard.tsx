import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { getNextDSTChange, DSTEvent, MarketRegion } from '../../utils/dstCalculator';
import { getTimezoneOffsetFromUser } from '../../utils/timezoneCalculator';
import { MarketHoliday } from '../../services/calendar';

interface MarketClockCardProps {
  marketCode: 'NYSE' | 'XPAR' | 'XLON' | 'XTKS';
  marketName: string;
  flagCode: string;
  timezone: string;
  tradingHours: { open: string; close: string };
  color: 'blue' | 'purple' | 'red';
  holidays: MarketHoliday[];
  holidaysLoading: boolean;
  region: MarketRegion;
  userTimezone: string;
}

export const MarketClockCard: React.FC<MarketClockCardProps> = ({
  marketCode,
  marketName,
  flagCode,
  timezone,
  tradingHours,
  color,
  holidays,
  holidaysLoading,
  region,
  userTimezone,
}) => {
  const { t } = useI18nTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dstEvent, setDstEvent] = useState<DSTEvent | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const event = getNextDSTChange(region);
    setDstEvent(event);

    const interval = setInterval(() => {
      const updatedEvent = getNextDSTChange(region);
      setDstEvent(updatedEvent);
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [region]);

  const isMarketOpen = useMemo(() => {
    // Ne pas calculer le statut tant que les jours fériés ne sont pas chargés
    // pour éviter d'afficher "ouvert" avant de vérifier les holidays
    if (holidaysLoading) return false;
    
    const now = new Date();
    
    // Obtenir l'heure actuelle dans la timezone du marché
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
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
    
    // Vérifier si c'est un weekend
    if (weekday === 'Sat' || weekday === 'Sun') return false;

    // Créer la date du jour dans la timezone du marché pour vérifier les jours fériés
    const todayStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const isHoliday = holidays.some(h => h.date === todayStr && h.market === marketCode);
    if (isHoliday) return false;

    const [openHour, openMinute] = tradingHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = tradingHours.close.split(':').map(Number);
    
    const currentMinutes = hour * 60 + minute;
    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, timezone, tradingHours, holidays, holidaysLoading, marketCode]);

  const formattedTime = useMemo(() => {
    return new Date(currentTime.toLocaleString('en-US', { timeZone: timezone }))
      .toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone, currentTime]);

  const timezoneOffset = useMemo(() => {
    // Calculer le décalage par rapport au timezone de l'utilisateur
    return getTimezoneOffsetFromUser(timezone, userTimezone, currentTime);
  }, [timezone, userTimezone, currentTime]);

  const isDSTUrgent = dstEvent && dstEvent.daysUntil <= 2;

  const colorClasses = {
    blue: {
      border: 'border-blue-200 dark:border-blue-800',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      header: 'bg-blue-100 dark:bg-blue-900/30',
    },
    purple: {
      border: 'border-purple-200 dark:border-purple-800',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-700 dark:text-purple-300',
      header: 'bg-purple-100 dark:bg-purple-900/30',
    },
    red: {
      border: 'border-red-200 dark:border-red-800',
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      header: 'bg-red-100 dark:bg-red-900/30',
    },
  };

  const classes = colorClasses[color];

  const getMarketLabel = (code: string) => {
    switch (code) {
      case 'NYSE':
        return 'NYSE';
      case 'XPAR':
        return 'Euronext';
      case 'XLON':
        return 'London Stock Exchange';
      case 'XTKS':
        return 'Tokyo Stock Exchange';
      default:
        return code;
    }
  };

  return (
    <div className={`flex flex-col border rounded-lg overflow-hidden transition-all duration-300 hover:scale-102 hover:shadow-lg ${classes.border} ${classes.bg}`}>
      <div className={`flex items-center justify-between px-2 py-1 ${classes.header}`}>
        <div className="flex items-center gap-1">
          <img
            src={`https://flagcdn.com/16x12/${flagCode}.png`}
            srcSet={`https://flagcdn.com/32x24/${flagCode}.png 2x`}
            width="14"
            height="10"
            alt={flagCode.toUpperCase()}
            className="inline-block"
          />
          <span className={`text-[10px] font-bold uppercase tracking-wide ${classes.text}`}>
            {getMarketLabel(marketCode)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`relative flex h-1.5 w-1.5 ${isMarketOpen ? '' : 'opacity-50'}`}>
            {isMarketOpen && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isMarketOpen ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
          </span>
          <span className={`text-[9px] font-medium ${isMarketOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {isMarketOpen ? t('common:open', { defaultValue: 'Ouvert' }) : t('common:closed', { defaultValue: 'Fermé' })}
          </span>
        </div>
      </div>
      
      <div className="flex items-start justify-between py-1.5 px-2 gap-2">
        <div className="flex items-start gap-2 flex-1">
          {timezoneOffset && (
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium pt-1">
              UTC{timezoneOffset.formatted}
            </div>
          )}
          <div className="flex flex-col items-center flex-1">
            <div className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
              {formattedTime}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              {tradingHours.open} - {tradingHours.close}
            </div>
          </div>
        </div>
        
        {dstEvent && (
          <div className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
            isDSTUrgent 
              ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 animate-pulse' 
              : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
          }`}>
            {dstEvent.type === 'spring' 
              ? t('common:dstChange.spring', { defaultValue: 'Heure d\'été' })
              : t('common:dstChange.fall', { defaultValue: 'Heure d\'hiver' })
            } {dstEvent.isToday 
              ? t('common:dstChange.today', { defaultValue: 'Aujourd\'hui' })
              : dstEvent.isTomorrow 
                ? t('common:dstChange.tomorrow', { defaultValue: 'Demain' })
                : `${t('common:dstChange.in', { defaultValue: 'dans' })} ${dstEvent.daysUntil}j`
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketClockCard;
