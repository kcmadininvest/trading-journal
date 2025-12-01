import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const yearPickerRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);
  const [calendarPosition, setCalendarPosition] = useState<'bottom' | 'top'>('bottom');
  const [calendarStyle, setCalendarStyle] = useState<{ top?: string; bottom?: string; left?: string; width?: string }>({});

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
        setShowMonthPicker(false);
        setShowYearPicker(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showCalendar]);

  // Fermer les pickers de mois/année quand on clique en dehors
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showMonthPicker && monthPickerRef.current && !monthPickerRef.current.contains(target)) {
        setShowMonthPicker(false);
      }
      if (showYearPicker && yearPickerRef.current && !yearPickerRef.current.contains(target)) {
        setShowYearPicker(false);
      }
    };
    if (showMonthPicker || showYearPicker) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [showMonthPicker, showYearPicker]);

  // Scroll automatique vers le haut (5 dernières années visibles) quand le picker d'année s'ouvre
  useEffect(() => {
    if (showYearPicker && yearListRef.current) {
      // Attendre un peu pour que le DOM soit rendu
      setTimeout(() => {
        if (yearListRef.current) {
          // Scroll vers le haut pour voir les 5 dernières années
          yearListRef.current.scrollTop = 0;
        }
      }, 10);
    }
  }, [showYearPicker]);

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

  // Calculer la position du calendrier pour éviter qu'il soit coupé
  useEffect(() => {
    if (showCalendar && containerRef.current) {
      // Attendre que le DOM soit rendu
      const calculatePosition = () => {
        if (!containerRef.current) return;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const calendarHeight = 350; // Hauteur approximative du calendrier
        const spaceBelow = window.innerHeight - containerRect.bottom;
        const spaceAbove = containerRect.top;
        const calendarWidth = Math.max(280, containerRect.width);
        
        // Calculer la position
        let top: string | undefined;
        let bottom: string | undefined;
        let position: 'bottom' | 'top' = 'bottom';
        
        if (spaceBelow < calendarHeight + 10 && spaceAbove > calendarHeight + 10) {
          // Positionner au-dessus
          position = 'top';
          bottom = `${window.innerHeight - containerRect.top + 4}px`;
        } else {
          // Positionner en dessous
          position = 'bottom';
          top = `${containerRect.bottom + 4}px`;
        }
        
        setCalendarPosition(position);
        setCalendarStyle({
          top: position === 'bottom' ? top : undefined,
          bottom: position === 'top' ? bottom : undefined,
          left: `${containerRect.left}px`,
          width: `${calendarWidth}px`,
        });
      };
      
      // Calculer immédiatement
      calculatePosition();
      
      // Recalculer après un court délai et lors du scroll/resize
      const timeoutId = setTimeout(calculatePosition, 10);
      const handleResize = () => calculatePosition();
      const handleScroll = () => calculatePosition();
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    } else {
      setCalendarStyle({});
    }
  }, [showCalendar, calendarMonth, calendarYear, showMonthPicker, showYearPicker]);

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

  const handleMonthSelect = (month: number) => {
    setCalendarMonth(month);
    setShowMonthPicker(false);
  };

  const handleYearSelect = (year: number) => {
    setCalendarYear(year);
    setShowYearPicker(false);
  };

  const goToToday = () => {
    const today = new Date();
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if ((!min || todayStr >= min) && (!max || todayStr <= max)) {
      onChange(todayStr);
      setDisplayValue(formatForDisplay(todayStr));
    }
  };

  // Générer la liste des années (20 ans en arrière jusqu'à l'année actuelle)
  const yearList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    // De 20 ans en arrière jusqu'à l'année actuelle (pas d'années futures)
    for (let i = currentYear; i >= currentYear - 20; i--) {
      years.push(i);
    }
    return years;
  }, []);

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
      
      {showCalendar && typeof document !== 'undefined' && createPortal(
        <div 
          ref={calendarRef}
          className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg p-3"
          style={calendarStyle}
        >
          {/* En-tête du calendrier */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Mois précédent"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Sélecteurs de mois et année */}
            <div className="flex items-center gap-2">
              <div className="relative" ref={monthPickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMonthPicker(!showMonthPicker);
                    setShowYearPicker(false);
                  }}
                  className="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[100px]"
                >
                  {monthNames[calendarMonth]}
                </button>
                {showMonthPicker && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg p-2 z-50 max-h-48 overflow-y-auto min-w-[120px]">
                    <div className="grid grid-cols-3 gap-1">
                      {monthNames.map((month, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleMonthSelect(index)}
                          className={`px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            calendarMonth === index
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {month.substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="relative" ref={yearPickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowYearPicker(!showYearPicker);
                    setShowMonthPicker(false);
                  }}
                  className="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[70px]"
                >
                  {calendarYear}
                </button>
                {showYearPicker && (
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl p-2 z-[70] min-w-[100px]">
                    <div ref={yearListRef} className="flex flex-col max-h-80 overflow-y-auto">
                      {yearList.map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => handleYearSelect(year)}
                          className={`w-full px-4 py-2.5 text-base rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium text-left ${
                            calendarYear === year
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Mois suivant"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* Bouton "Aujourd'hui" */}
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('calendar:today', { defaultValue: 'Aujourd\'hui' })}
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
        </div>,
        document.body
      )}
    </div>
  );
};
