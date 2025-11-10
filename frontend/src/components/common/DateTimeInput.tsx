import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDate, formatDateTimeShort, getMonthNames, getDayNames } from '../../utils/dateFormat';

interface DateTimeInputProps {
  value: string; // Format ISO (YYYY-MM-DDTHH:mm) ou vide
  onChange: (value: string) => void; // Retourne le format ISO (YYYY-MM-DDTHH:mm)
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  id?: string;
  title?: string;
}

/**
 * Composant d'input de date/heure personnalisé qui formate selon les préférences utilisateur
 * La valeur interne est toujours en format ISO (YYYY-MM-DDTHH:mm)
 * L'affichage est formaté selon preferences.date_format (EU ou US) et timezone
 */
export const DateTimeInput: React.FC<DateTimeInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  required = false,
  disabled = false,
  min,
  max,
  id,
  title,
}) => {
  const { preferences } = usePreferences();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convertir ISO (YYYY-MM-DDTHH:mm) vers format préféré pour l'affichage
  const formatForDisplay = useCallback((isoDateTime: string): string => {
    if (!isoDateTime) return '';
    // formatDateTimeShort accepte les dates ISO directement
    const formatted = formatDateTimeShort(isoDateTime, preferences.date_format, preferences.timezone);
    return formatted || '';
  }, [preferences.date_format, preferences.timezone]);

  // Convertir format préféré vers ISO (YYYY-MM-DDTHH:mm)
  const parseToISO = (displayDateTime: string): string | null => {
    if (!displayDateTime.trim()) return null;

    // Format attendu: DD/MM/YYYY HH:mm ou MM/DD/YYYY HH:mm selon date_format
    const parts = displayDateTime.trim().split(' ');
    if (parts.length !== 2) return null;

    const datePart = parts[0];
    const timePart = parts[1];

    // Parser la partie date
    let day: string, month: string, year: string;
    const separators = ['/', '-', '.'];
    
    let separator = '';
    for (const sep of separators) {
      if (datePart.includes(sep)) {
        separator = sep;
        break;
      }
    }

    if (!separator) return null;

    const dateParts = datePart.split(separator).map(p => p.trim());

    if (preferences.date_format === 'US') {
      // Format US: MM/DD/YYYY
      if (dateParts.length !== 3) return null;
      month = dateParts[0].padStart(2, '0');
      day = dateParts[1].padStart(2, '0');
      year = dateParts[2];
    } else {
      // Format EU: DD/MM/YYYY
      if (dateParts.length !== 3) return null;
      day = dateParts[0].padStart(2, '0');
      month = dateParts[1].padStart(2, '0');
      year = dateParts[2];
    }

    // Parser la partie heure (HH:mm)
    const timeParts = timePart.split(':');
    if (timeParts.length !== 2) return null;
    const hours = timeParts[0].padStart(2, '0');
    const minutes = timeParts[1].padStart(2, '0');

    // Valider
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const hoursNum = parseInt(hours, 10);
    const minutesNum = parseInt(minutes, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum) || isNaN(hoursNum) || isNaN(minutesNum)) return null;
    if (monthNum < 1 || monthNum > 12) return null;
    if (dayNum < 1 || dayNum > 31) return null;
    if (hoursNum < 0 || hoursNum > 23) return null;
    if (minutesNum < 0 || minutesNum > 59) return null;

    // Créer une date pour valider
    const date = new Date(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum);
    if (
      date.getFullYear() !== yearNum ||
      date.getMonth() !== monthNum - 1 ||
      date.getDate() !== dayNum ||
      date.getHours() !== hoursNum ||
      date.getMinutes() !== minutesNum
    ) {
      return null;
    }

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Générer un placeholder selon le format préféré
  const placeholderText = useMemo(() => {
    const now = new Date();
    const formatted = formatDateTimeShort(now, preferences.date_format, preferences.timezone);
    return formatted || '';
  }, [preferences.date_format, preferences.timezone]);

  // Synchroniser le calendrier avec la date sélectionnée
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setCalendarMonth(date.getMonth());
        setCalendarYear(date.getFullYear());
      }
    }
  }, [value]);

  // Mettre à jour la valeur d'affichage quand la valeur ISO change (sauf pendant la saisie)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatForDisplay(value));
    }
  }, [value, isFocused, formatForDisplay]);

  // Fermer le calendrier quand on clique en dehors
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showCalendar && containerRef.current && !containerRef.current.contains(target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showCalendar]);

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(formatForDisplay(value));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Délai pour permettre le clic sur le calendrier
    setTimeout(() => {
      setIsFocused(false);
      const isoValue = parseToISO(e.target.value);
      if (isoValue) {
        // Valider les limites min/max si définies
        if (min && isoValue < min) {
          setDisplayValue(formatForDisplay(min));
          onChange(min);
        } else if (max && isoValue > max) {
          setDisplayValue(formatForDisplay(max));
          onChange(max);
        } else {
          setDisplayValue(formatForDisplay(isoValue));
          onChange(isoValue);
        }
      } else if (displayValue.trim() === '') {
        onChange('');
        setDisplayValue('');
      } else {
        // Si la date n'est pas valide, réinitialiser à la valeur originale
        setDisplayValue(formatForDisplay(value));
      }
    }, 200);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleCalendarToggle = () => {
    setShowCalendar(!showCalendar);
    if (!showCalendar && value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setCalendarMonth(date.getMonth());
        setCalendarYear(date.getFullYear());
      }
    }
  };

  const handleDateSelect = (day: number, month: number, year: number) => {
    // Conserver l'heure actuelle si elle existe, sinon utiliser l'heure actuelle
    let hours = 0;
    let minutes = 0;
    
    if (value) {
      const currentDate = new Date(value);
      if (!isNaN(currentDate.getTime())) {
        hours = currentDate.getHours();
        minutes = currentDate.getMinutes();
      }
    } else {
      const now = new Date();
      hours = now.getHours();
      minutes = now.getMinutes();
    }
    
    const isoDateTime = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    // Valider les limites min/max si définies
    if (min && isoDateTime < min) return;
    if (max && isoDateTime > max) return;
    
    onChange(isoDateTime);
    setDisplayValue(formatForDisplay(isoDateTime));
    setShowCalendar(false);
  };

  // Générer les jours du calendrier
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Dimanche, 1 = Lundi, etc.

    const days: (number | null)[] = [];
    
    // Ajouter les jours vides au début pour aligner le calendrier
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Ajouter les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, [calendarMonth, calendarYear]);

  const monthNames = getMonthNames(preferences.language as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh');
  const dayNames = getDayNames(preferences.language as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh');
  // Prendre seulement les 3 premiers caractères pour l'affichage compact
  const shortDayNames = dayNames.map(name => name.substring(0, 3));

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (calendarMonth === 0) {
        setCalendarMonth(11);
        setCalendarYear(calendarYear - 1);
      } else {
        setCalendarMonth(calendarMonth - 1);
      }
    } else {
      if (calendarMonth === 11) {
        setCalendarMonth(0);
        setCalendarYear(calendarYear + 1);
      } else {
        setCalendarMonth(calendarMonth + 1);
      }
    }
  };

  // Obtenir la date actuelle pour surligner le jour actuel
  const today = new Date();
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      calendarMonth === today.getMonth() &&
      calendarYear === today.getFullYear()
    );
  };

  // Obtenir la date sélectionnée pour la surligner
  const selectedDate = value ? new Date(value) : null;
  const isSelected = (day: number) => {
    if (!selectedDate || isNaN(selectedDate.getTime())) return false;
    return (
      day === selectedDate.getDate() &&
      calendarMonth === selectedDate.getMonth() &&
      calendarYear === selectedDate.getFullYear()
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || placeholderText}
          className={className}
          required={required}
          disabled={disabled}
          title={title}
          pattern={preferences.date_format === 'US' 
            ? '\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}' 
            : '\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}'}
        />
        <button
          type="button"
          onClick={handleCalendarToggle}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none disabled:opacity-50"
          title="Ouvrir le calendrier"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {showCalendar && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[280px]">
          {/* En-tête du calendrier */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {monthNames[calendarMonth]} {calendarYear}
            </div>
            <button
              type="button"
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {shortDayNames.map((dayName, index) => (
              <div
                key={index}
                className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Grille du calendrier */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={index} className="aspect-square" />;
              }

              const dayIsToday = isToday(day);
              const dayIsSelected = isSelected(day);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDateSelect(day, calendarMonth, calendarYear)}
                  className={`
                    aspect-square rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${dayIsSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : dayIsToday
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-semibold'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

