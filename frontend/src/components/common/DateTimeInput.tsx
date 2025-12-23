import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDateTimeShort, getMonthNames, getDayNames } from '../../utils/dateFormat';

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
  const { t } = useTranslation();
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingHours, setEditingHours] = useState<string | null>(null);
  const [editingMinutes, setEditingMinutes] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const yearPickerRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);

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
        setShowMonthPicker(false);
        setShowYearPicker(false);
        setShowTimePicker(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showCalendar]);

  // Fermer les pickers de mois/année/heure quand on clique en dehors
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showMonthPicker && monthPickerRef.current && !monthPickerRef.current.contains(target)) {
        setShowMonthPicker(false);
      }
      if (showYearPicker && yearPickerRef.current && !yearPickerRef.current.contains(target)) {
        setShowYearPicker(false);
      }
      if (showTimePicker && timePickerRef.current && !timePickerRef.current.contains(target)) {
        setShowTimePicker(false);
      }
    };
    if (showMonthPicker || showYearPicker || showTimePicker) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [showMonthPicker, showYearPicker, showTimePicker]);

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

  // Fonction pour formater automatiquement la saisie avec les séparateurs
  const formatInputWithSeparators = (input: string): string => {
    // Extraire uniquement les chiffres
    const digitsOnly = input.replace(/\D/g, '');
    
    if (digitsOnly.length === 0) return '';
    
    let formatted = '';
    let digitIndex = 0;
    
    // Format de date selon les préférences
    if (preferences.date_format === 'US') {
      // Format US: MM/DD/YYYY HH:mm
      // MM (2 chiffres)
      if (digitIndex < digitsOnly.length) {
        formatted += digitsOnly.substring(digitIndex, Math.min(digitIndex + 2, digitsOnly.length));
        digitIndex = Math.min(digitIndex + 2, digitsOnly.length);
        if (digitIndex < digitsOnly.length && digitsOnly.length > 2) formatted += '/';
      }
      // DD (2 chiffres)
      if (digitIndex < digitsOnly.length) {
        formatted += digitsOnly.substring(digitIndex, Math.min(digitIndex + 2, digitsOnly.length));
        digitIndex = Math.min(digitIndex + 2, digitsOnly.length);
        if (digitIndex < digitsOnly.length && digitsOnly.length > 4) formatted += '/';
      }
      // YYYY (4 chiffres)
      if (digitIndex < digitsOnly.length) {
        formatted += digitsOnly.substring(digitIndex, Math.min(digitIndex + 4, digitsOnly.length));
        digitIndex = Math.min(digitIndex + 4, digitsOnly.length);
        if (digitIndex < digitsOnly.length && digitsOnly.length > 8) formatted += ' ';
      }
    } else {
      // Format EU: DD/MM/YYYY HH:mm
      // DD (2 chiffres)
      if (digitIndex < digitsOnly.length) {
        formatted += digitsOnly.substring(digitIndex, Math.min(digitIndex + 2, digitsOnly.length));
        digitIndex = Math.min(digitIndex + 2, digitsOnly.length);
        if (digitIndex < digitsOnly.length && digitsOnly.length > 2) formatted += '/';
      }
      // MM (2 chiffres)
      if (digitIndex < digitsOnly.length) {
        formatted += digitsOnly.substring(digitIndex, Math.min(digitIndex + 2, digitsOnly.length));
        digitIndex = Math.min(digitIndex + 2, digitsOnly.length);
        if (digitIndex < digitsOnly.length && digitsOnly.length > 4) formatted += '/';
      }
      // YYYY (4 chiffres)
      if (digitIndex < digitsOnly.length) {
        formatted += digitsOnly.substring(digitIndex, Math.min(digitIndex + 4, digitsOnly.length));
        digitIndex = Math.min(digitIndex + 4, digitsOnly.length);
        if (digitIndex < digitsOnly.length && digitsOnly.length > 8) formatted += ' ';
      }
    }
    
    // HH (2 chiffres)
    if (digitIndex < digitsOnly.length) {
      formatted += digitsOnly.substring(digitIndex, Math.min(digitIndex + 2, digitsOnly.length));
      digitIndex = Math.min(digitIndex + 2, digitsOnly.length);
      if (digitIndex < digitsOnly.length && digitsOnly.length > 10) formatted += ':';
    }
    
    // mm (2 chiffres)
    if (digitIndex < digitsOnly.length) {
      formatted += digitsOnly.substring(digitIndex, Math.min(digitIndex + 2, digitsOnly.length));
    }
    
    return formatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatInputWithSeparators(inputValue);
    setDisplayValue(formatted);
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
    // Ne pas fermer le calendrier pour permettre la sélection de l'heure
  };

  // Obtenir l'heure actuelle depuis la valeur
  const getCurrentTime = () => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return { hours: date.getHours(), minutes: date.getMinutes() };
      }
    }
    const now = new Date();
    return { hours: now.getHours(), minutes: now.getMinutes() };
  };

  // Mettre à jour l'heure
  const updateTime = (hours: number, minutes: number) => {
    // S'assurer que les valeurs sont dans les limites
    hours = Math.max(0, Math.min(23, hours));
    minutes = Math.max(0, Math.min(59, minutes));

    // Obtenir la date actuelle ou utiliser la date du calendrier
    let year: number;
    let month: number;
    let day: number;

    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        year = date.getFullYear();
        month = date.getMonth();
        day = date.getDate();
      } else {
        // Si la valeur n'est pas valide, utiliser la date du calendrier ou aujourd'hui
        const now = new Date();
        year = calendarYear;
        month = calendarMonth;
        day = now.getDate();
      }
    } else {
      // Si aucune valeur, utiliser la date du calendrier ou aujourd'hui
      const now = new Date();
      if (calendarYear === now.getFullYear() && calendarMonth === now.getMonth()) {
        year = calendarYear;
        month = calendarMonth;
        day = now.getDate();
      } else {
        year = calendarYear;
        month = calendarMonth;
        day = 1; // Premier jour du mois affiché
      }
    }

    const isoDateTime = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    // Valider les limites min/max si définies
    if (min && isoDateTime < min) return;
    if (max && isoDateTime > max) return;
    
    onChange(isoDateTime);
    setDisplayValue(formatForDisplay(isoDateTime));
  };

  // Incrémenter/décrémenter l'heure
  const adjustTime = (type: 'hours' | 'minutes', delta: number) => {
    const { hours, minutes } = getCurrentTime();
    if (type === 'hours') {
      updateTime(hours + delta, minutes);
    } else {
      updateTime(hours, minutes + delta);
    }
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
    const hours = today.getHours();
    const minutes = today.getMinutes();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
          <div className="grid grid-cols-7 gap-1 mb-4">
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

          {/* Séparateur */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

          {/* Sélecteur d'heure moderne */}
          <div className="relative" ref={timePickerRef}>
            <div className="flex items-center justify-center gap-4">
              {/* Heures */}
              <div className="flex flex-col items-center">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {t('common:hours', { defaultValue: 'Heures' })}
                </label>
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustTime('hours', 1)}
                    className="w-10 h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    title="Augmenter les heures"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  {editingHours !== null ? (
                    <input
                      ref={hoursInputRef}
                      type="number"
                      min="0"
                      max="23"
                      value={editingHours}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 23)) {
                          setEditingHours(val);
                        }
                      }}
                      onBlur={() => {
                        const val = parseInt(editingHours);
                        if (!isNaN(val) && val >= 0 && val <= 23) {
                          const { minutes } = getCurrentTime();
                          updateTime(val, minutes);
                        }
                        setEditingHours(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          setEditingHours(null);
                        }
                      }}
                      className="w-16 h-12 text-center text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingHours(String(getCurrentTime().hours));
                        setTimeout(() => hoursInputRef.current?.select(), 0);
                      }}
                      className="w-16 h-12 flex items-center justify-center text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {String(getCurrentTime().hours).padStart(2, '0')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => adjustTime('hours', -1)}
                    className="w-10 h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    title="Diminuer les heures"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Séparateur deux-points */}
              <div className="text-2xl font-bold text-gray-400 dark:text-gray-500 mt-6">:</div>

              {/* Minutes */}
              <div className="flex flex-col items-center">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {t('common:minutes', { defaultValue: 'Minutes' })}
                </label>
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => adjustTime('minutes', 1)}
                    className="w-10 h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    title="Augmenter les minutes"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  {editingMinutes !== null ? (
                    <input
                      ref={minutesInputRef}
                      type="number"
                      min="0"
                      max="59"
                      value={editingMinutes}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                          setEditingMinutes(val);
                        }
                      }}
                      onBlur={() => {
                        const val = parseInt(editingMinutes);
                        if (!isNaN(val) && val >= 0 && val <= 59) {
                          const { hours } = getCurrentTime();
                          updateTime(hours, val);
                        }
                        setEditingMinutes(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                          setEditingMinutes(null);
                        }
                      }}
                      className="w-16 h-12 text-center text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMinutes(String(getCurrentTime().minutes));
                        setTimeout(() => minutesInputRef.current?.select(), 0);
                      }}
                      className="w-16 h-12 flex items-center justify-center text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {String(getCurrentTime().minutes).padStart(2, '0')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => adjustTime('minutes', -1)}
                    className="w-10 h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    title="Diminuer les minutes"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Boutons d'action rapide pour l'heure */}
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  updateTime(now.getHours(), now.getMinutes());
                }}
                className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {t('common:currentTime', { defaultValue: 'Heure actuelle' })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCalendar(false);
                  setShowTimePicker(false);
                }}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                {t('common:done', { defaultValue: 'Terminé' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

