import React, { useState, useEffect } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { getNextDSTChange, DSTEvent } from '../../utils/dstCalculator';

interface NYSEDSTIndicatorProps {
  className?: string;
}

export const NYSEDSTIndicator: React.FC<NYSEDSTIndicatorProps> = ({ className = '' }) => {
  const { t, i18n } = useI18nTranslation();
  const [dstEvent, setDstEvent] = useState<DSTEvent | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Calculer le prochain changement d'heure
    const event = getNextDSTChange();
    setDstEvent(event);

    // Mettre à jour toutes les heures pour garder le compte à rebours précis
    const interval = setInterval(() => {
      const updatedEvent = getNextDSTChange();
      setDstEvent(updatedEvent);
    }, 60 * 60 * 1000); // Toutes les heures

    return () => clearInterval(interval);
  }, []);

  if (!dstEvent) {
    return null;
  }

  // Toujours afficher le prochain événement DST, quelle que soit la distance
  // (important pour les traders internationaux qui planifient à l'avance)

  const currentLanguage = i18n.language?.split('-')[0] || 'fr';
  const isCloseToEvent = dstEvent.daysUntil <= 7;
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
    timeZone: 'America/New_York',
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
    defaultValue: `Changement d'heure NYSE : ${formattedDate} à ${formattedTime}`,
  });

  // Icône selon le type de changement
  const icon = dstEvent.type === 'spring' ? (
    // Horloge avec flèche vers l'avant (spring forward)
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 4l3 3-3 3" />
    </svg>
  ) : (
    // Horloge avec flèche vers l'arrière (fall back)
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4L5 7l3 3" />
    </svg>
  );

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium cursor-default select-none transition-colors ${
          isVeryClose
            ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 animate-pulse'
            : isCloseToEvent
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
        }`}
      >
        <span
          className={`flex-shrink-0 ${
            isVeryClose
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                isVeryClose
                  ? 'text-blue-700 dark:text-blue-300 font-extrabold'
                  : 'text-blue-600 dark:text-blue-400'
              }`}
            >
              NYSE
              {' '}
              <img
                src="https://flagcdn.com/16x12/us.png"
                srcSet="https://flagcdn.com/32x24/us.png 2x"
                width="16"
                height="12"
                alt="US"
                className="inline-block align-middle"
              />
            </span>
            <span
              className={`text-xs font-medium leading-tight ${
                isVeryClose
                  ? 'text-gray-950 dark:text-white font-bold'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {typeLabel}
            </span>
          </div>
          <span
            className={`text-[11px] ${
              isVeryClose
                ? 'text-gray-700 dark:text-gray-300 font-semibold'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {countdownLabel}
          </span>
        </div>
      </div>

      {hovered && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 pointer-events-none">
          <div className="w-2 h-2 bg-gray-900 border-t border-l border-gray-700 rotate-45 mx-auto -mb-1" />
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl px-3 py-2.5 text-left min-w-[200px] max-w-[300px]">
            <div className="font-semibold text-white text-xs mb-1">
              {dstEvent.type === 'spring'
                ? t('common:dstChange.spring', { defaultValue: 'Heure d\'été' })
                : t('common:dstChange.fall', { defaultValue: 'Heure d\'hiver' })}
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

export default NYSEDSTIndicator;
