import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDate, getMonthNames, getDayNames } from '../../utils/dateFormat';

interface DateInputProps {
  value: string; // Format ISO (YYYY-MM-DD)
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  max?: string;
}

/**
 * Composant d'input de date personnalisé qui formate selon les préférences utilisateur
 * La valeur interne est toujours en format ISO (YYYY-MM-DD)
 * L'affichage est formaté selon preferences.date_format (EU ou US)
 * Inclut un calendrier déroulant pour faciliter la sélection
 */
export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  min,
  max,
}) => {
  const { preferences } = usePreferences();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convertir ISO (YYYY-MM-DD) vers format préféré pour l'affichage
  const formatForDisplay = useCallback((isoDate: string): string => {
    if (!isoDate) return '';
    // formatDate accepte les dates ISO directement
    const formatted = formatDate(isoDate, preferences.date_format);
    return formatted || '';
  }, [preferences.date_format]);

  // Convertir format préféré vers ISO (YYYY-MM-DD)
  const parseToISO = (displayDate: string): string | null => {
    if (!displayDate.trim()) return null;

    let day: string, month: string, year: string;
    const separators = ['/', '-', '.'];

    // Détecter le séparateur
    let separator = '';
    for (const sep of separators) {
      if (displayDate.includes(sep)) {
        separator = sep;
        break;
      }
    }

    if (!separator) return null;

    const parts = displayDate.split(separator).map(p => p.trim());

    if (preferences.date_format === 'US') {
      // Format US: MM/DD/YYYY
      if (parts.length !== 3) return null;
      month = parts[0].padStart(2, '0');
      day = parts[1].padStart(2, '0');
      year = parts[2];
    } else {
      // Format EU: DD/MM/YYYY
      if (parts.length !== 3) return null;
      day = parts[0].padStart(2, '0');
      month = parts[1].padStart(2, '0');
      year = parts[2];
    }

    // Valider et convertir en ISO
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) return null;
    if (monthNum < 1 || monthNum > 12) return null;
    if (dayNum < 1 || dayNum > 31) return null;

    // Créer une date pour valider
    const date = new Date(yearNum, monthNum - 1, dayNum);
    if (
      date.getFullYear() !== yearNum ||
      date.getMonth() !== monthNum - 1 ||
      date.getDate() !== dayNum
    ) {
      return null;
    }

    return `${year}-${month}-${day}`;
  };

  // Générer un placeholder selon le format préféré
  const placeholderText = useMemo(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    if (preferences.date_format === 'US') {
      return `${month}/${day}/${year}`;
    } else {
      return `${day}/${month}/${year}`;
    }
  }, [preferences.date_format]);

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
      const isoDate = parseToISO(e.target.value);
      if (isoDate) {
        // Valider les limites min/max si définies
        if (min && isoDate < min) {
          setDisplayValue(formatForDisplay(min));
          onChange(min);
        } else if (max && isoDate > max) {
          setDisplayValue(formatForDisplay(max));
          onChange(max);
        } else {
          setDisplayValue(formatForDisplay(isoDate));
          onChange(isoDate);
        }
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
    const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Valider les limites min/max si définies
    if (min && isoDate < min) return;
    if (max && isoDate > max) return;
    
    onChange(isoDate);
    setDisplayValue(formatForDisplay(isoDate));
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

  const selectedDate = value ? new Date(value) : null;
  const isDateSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === calendarMonth &&
      selectedDate.getFullYear() === calendarYear
    );
  };

  const isDateDisabled = (day: number) => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  const today = new Date();
  const isToday = (day: number) => {
    return (
      today.getDate() === day &&
      today.getMonth() === calendarMonth &&
      today.getFullYear() === calendarYear
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || placeholderText}
          className={className}
        />
        <button
          type="button"
          onClick={handleCalendarToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none p-1"
          tabIndex={-1}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
      
      {showCalendar && (
        <div className="absolute z-[60] mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg p-3 min-w-[280px]">
          {/* En-tête du calendrier */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {monthNames[calendarMonth]} {calendarYear}
            </div>
            <button
              type="button"
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {shortDayNames.map((dayName, index) => (
              <div key={index} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                {dayName}
              </div>
            ))}
          </div>

          {/* Grille du calendrier */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <div key={index}>
                {day === null ? (
                  <div className="aspect-square" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDateSelect(day, calendarMonth, calendarYear)}
                    disabled={isDateDisabled(day)}
                    className={`
                      w-full aspect-square text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${isDateSelected(day)
                        ? 'bg-blue-600 text-white font-semibold'
                        : isToday(day)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                      ${isDateDisabled(day) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
