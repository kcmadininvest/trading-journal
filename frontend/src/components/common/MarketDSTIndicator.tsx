import React, { useState, useEffect } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { getNextDSTChange, DSTEvent, MarketRegion } from '../../utils/dstCalculator';
import { getMarketTimezoneOffset } from '../../utils/timezoneCalculator';

interface MarketDSTIndicatorProps {
  region: MarketRegion;
  marketCode: string;
  marketName: string;
  flagCode: string;
  color: 'blue' | 'purple';
  showTimezoneOffset?: boolean;
  className?: string;
}

export const MarketDSTIndicator: React.FC<MarketDSTIndicatorProps> = ({
  region,
  marketCode,
  marketName,
  flagCode,
  color,
  showTimezoneOffset = false,
  className = '',
}) => {
  const { t, i18n } = useI18nTranslation();
  const [dstEvent, setDstEvent] = useState<DSTEvent | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Calculer le prochain changement d'heure
    const event = getNextDSTChange(region);
    setDstEvent(event);

    // Mettre à jour toutes les heures pour garder le compte à rebours précis
    const interval = setInterval(() => {
      const updatedEvent = getNextDSTChange(region);
      setDstEvent(updatedEvent);
    }, 60 * 60 * 1000); // Toutes les heures

    return () => clearInterval(interval);
  }, [region]);

  if (!dstEvent) {
    return null;
  }

  const currentLanguage = i18n.language?.split('-')[0] || 'fr';
  const isVeryClose = dstEvent.isToday || dstEvent.isTomorrow;

  // Formater la date pour le tooltip
  const dateFormatter = new Intl.DateTimeFormat(currentLanguage, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat(currentLanguage, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: region === 'US' ? 'America/New_York' : 'Europe/Paris',
  });

  const formattedDate = dateFormatter.format(dstEvent.date);
  const formattedTime = timeFormatter.format(dstEvent.date);

  // Déterminer le label du type de changement
  const typeLabel = dstEvent.type === 'spring'
    ? t('common:dstChange.spring', { defaultValue: 'Heure d\'été' })
    : t('common:dstChange.fall', { defaultValue: 'Heure d\'hiver' });

  // Déterminer le label du compte à rebours
  let countdownLabel: string;
  if (dstEvent.isToday) {
    countdownLabel = t('common:dstChange.today', { defaultValue: 'Aujourd\'hui' });
  } else if (dstEvent.isTomorrow) {
    countdownLabel = t('common:dstChange.tomorrow', { defaultValue: 'Demain' });
  } else {
    const daysWord = t('common:dstChange.days', { defaultValue: 'jours' });
    const inWord = t('common:dstChange.in', { defaultValue: 'dans' });
    countdownLabel = `${inWord} ${dstEvent.daysUntil} ${daysWord}`;
  }

  // Tooltip message
  const tooltipMessage = t('common:dstChange.tooltip', {
    date: formattedDate,
    time: formattedTime,
    defaultValue: `Changement d'heure ${marketName} : ${formattedDate} à ${formattedTime}`,
  });

  // Couleurs selon le marché
  const colorClasses = color === 'blue' 
    ? {
        badge: isVeryClose
          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
        icon: isVeryClose ? 'text-amber-700 dark:text-amber-300' : 'text-amber-600 dark:text-amber-400',
        market: isVeryClose ? 'text-blue-700 dark:text-blue-300 font-extrabold' : 'text-blue-600 dark:text-blue-400',
        title: isVeryClose ? 'text-gray-950 dark:text-white font-bold' : 'text-gray-900 dark:text-white',
        countdown: isVeryClose ? 'text-gray-700 dark:text-gray-300 font-semibold' : 'text-gray-500 dark:text-gray-400',
      }
    : {
        badge: isVeryClose
          ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
        icon: isVeryClose ? 'text-amber-700 dark:text-amber-300' : 'text-amber-600 dark:text-amber-400',
        market: isVeryClose ? 'text-purple-700 dark:text-purple-300 font-extrabold' : 'text-purple-600 dark:text-purple-400',
        title: isVeryClose ? 'text-gray-950 dark:text-white font-bold' : 'text-gray-900 dark:text-white',
        countdown: isVeryClose ? 'text-gray-700 dark:text-gray-300 font-semibold' : 'text-gray-500 dark:text-gray-400',
      };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium cursor-default select-none transition-colors ${
          isVeryClose ? `${colorClasses.badge} animate-pulse` : colorClasses.badge
        }`}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-semibold uppercase tracking-wide ${colorClasses.market}`}>
              {marketCode}
              {' '}
              <img
                src={`https://flagcdn.com/16x12/${flagCode}.png`}
                srcSet={`https://flagcdn.com/32x24/${flagCode}.png 2x`}
                width="16"
                height="12"
                alt={flagCode.toUpperCase()}
                className="inline-block align-middle"
              />
              {showTimezoneOffset && getMarketTimezoneOffset(marketCode) && (
                <span className="ml-1 text-[9px] opacity-70">
                  {getMarketTimezoneOffset(marketCode)}
                </span>
              )}
            </span>
            <span className={`text-sm font-medium leading-tight ${colorClasses.title}`}>
              {typeLabel}
            </span>
          </div>
          <span className={`text-xs ${colorClasses.countdown}`}>
            {countdownLabel}
          </span>
        </div>
      </div>

      {hovered && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
          <div className="w-2 h-2 bg-gray-900 border-t border-l border-gray-700 rotate-45 mx-auto -mb-1" />
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl px-3 py-2.5 text-left min-w-[200px] max-w-[300px]">
            <div className="font-semibold text-white text-xs mb-1">
              {marketName} - {typeLabel}
            </div>
            <div className="text-gray-300 text-xs leading-relaxed">
              {tooltipMessage}
            </div>
            {dstEvent.type === 'spring' && (
              <div className="text-amber-400 text-xs mt-1.5 border-t border-gray-700 pt-1.5">
                ⏰ Les horloges avancent d'1 heure
              </div>
            )}
            {dstEvent.type === 'fall' && (
              <div className="text-blue-400 text-xs mt-1.5 border-t border-gray-700 pt-1.5">
                ⏰ Les horloges reculent d'1 heure
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketDSTIndicator;
