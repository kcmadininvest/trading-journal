import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDateTimeShort } from '../../utils/dateFormat';

interface DateTimeInputProps {
  value: string; // Format ISO: YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  showTime?: boolean;
  compact?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
}

export const DateTimeInput: React.FC<DateTimeInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false,
  required = false,
  id,
  name,
  min,
  max,
  showTime = true,
  compact = false,
  onKeyDown,
  'aria-label': ariaLabel,
}) => {
  const { t, i18n } = useTranslation(['common']);
  const { preferences } = usePreferences();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [editingHours, setEditingHours] = useState<string | null>(null);
  const [editingMinutes, setEditingMinutes] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const [calendarStyle, setCalendarStyle] = useState<{
    top?: string;
    bottom?: string;
    left?: string;
    width?: string;
    maxHeight?: string;
  }>({});

  const isCompact = compact || className.includes('text-xs') || className.includes('text-sm');

  const formatForDisplay = useCallback((isoDateTime: string): string => {
    if (!isoDateTime) return '';
    try {
      return formatDateTimeShort(isoDateTime, preferences.date_format, preferences.timezone);
    } catch {
      return isoDateTime;
    }
  }, [preferences.date_format, preferences.timezone]);

  useEffect(() => {
    if (value) {
      setInputValue(formatForDisplay(value));
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        setSelectedHour(date.getHours());
        setSelectedMinute(date.getMinutes());
      }
    } else {
      setInputValue('');
      const now = new Date();
      setSelectedHour(now.getHours());
      setSelectedMinute(now.getMinutes());
    }
  }, [value, formatForDisplay]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        calendarRef.current &&
        !calendarRef.current.contains(target)
      ) {
        setShowCalendar(false);
        setShowTimePicker(false);
        setEditingHours(null);
        setEditingMinutes(null);
      }
    };

    if (showCalendar || showTimePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendar, showTimePicker]);

  useEffect(() => {
    if (!(showCalendar || showTimePicker) || !containerRef.current) return;

    const calculatePosition = () => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const measuredHeight = calendarRef.current?.offsetHeight;
      const calendarHeight = measuredHeight && measuredHeight > 0
        ? measuredHeight
        : isCompact
          ? 420
          : 480;
      const calendarWidth = isCompact ? 300 : 340;
      const gap = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spaceRight = viewportWidth - containerRect.right - gap;
      const spaceLeft = containerRect.left - gap;

      let left: number;
      // Préférer à droite du champ (évite de sortir en bas dans les tableaux).
      if (spaceRight >= calendarWidth || spaceRight >= spaceLeft) {
        left = Math.min(containerRect.right + gap, viewportWidth - calendarWidth - gap);
        if (left < gap) left = gap;
      } else {
        left = Math.max(gap, containerRect.left - calendarWidth - gap);
      }

      // Aligner verticalement sur le champ, puis clamper dans le viewport.
      const maxTop = Math.max(gap, viewportHeight - calendarHeight - gap);
      const top = Math.min(Math.max(gap, containerRect.top), maxTop);

      setCalendarStyle({
        top: `${top}px`,
        bottom: undefined,
        left: `${left}px`,
        width: `${calendarWidth}px`,
        maxHeight: `${viewportHeight - gap * 2}px`,
      });
    };

    calculatePosition();
    const timeoutId = setTimeout(calculatePosition, 0);
    const rafId = requestAnimationFrame(calculatePosition);
    window.addEventListener('scroll', calculatePosition, true);
    window.addEventListener('resize', calculatePosition);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', calculatePosition, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [showCalendar, showTimePicker, isCompact, selectedHour, selectedMinute]);

  const parseToISO = (displayValue: string): string | null => {
    if (!displayValue.trim()) return null;

    const formats = [
      /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s+(\d{1,2}):(\d{2})$/,
      /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\s+(\d{1,2}):(\d{2})$/,
      /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/,
      /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/,
    ];

    for (const format of formats) {
      const match = displayValue.match(format);
      if (match) {
        let year: number, month: number, day: number, hours = 0, minutes = 0;

        if (format.source.includes('\\d{4}') && format.source.indexOf('\\d{4}') < 10) {
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          day = parseInt(match[3], 10);
          if (match[4]) hours = parseInt(match[4], 10);
          if (match[5]) minutes = parseInt(match[5], 10);
        } else {
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
          if (match[4]) hours = parseInt(match[4], 10);
          if (match[5]) minutes = parseInt(match[5], 10);
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          const date = new Date(year, month - 1, day, hours, minutes);
          if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          }
        }
      }
    }

    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const isoValue = parseToISO(newValue);
    if (isoValue) {
      if (min && isoValue < min) return;
      if (max && isoValue > max) return;
      onChange(isoValue);
    } else if (!newValue.trim()) {
      onChange('');
    }
  };

  const handleInputBlur = () => {
    if (inputValue.trim()) {
      const isoValue = parseToISO(inputValue);
      if (isoValue) {
        setInputValue(formatForDisplay(isoValue));
      } else {
        setInputValue(value ? formatForDisplay(value) : '');
      }
    } else {
      onChange('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
    onKeyDown?.(e);
  };

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  };

  const handleDateSelect = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const hours = showTime ? selectedHour : 0;
    const minutes = showTime ? selectedMinute : 0;

    const isoValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    if (min && isoValue < min) return;
    if (max && isoValue > max) return;

    onChange(isoValue);
    if (!showTime) {
      setShowCalendar(false);
    } else {
      setShowTimePicker(true);
    }
  };

  const handleTimeChange = (hour: number, minute: number) => {
    const wrappedHour = ((hour % 24) + 24) % 24;
    const wrappedMinute = ((minute % 60) + 60) % 60;
    setSelectedHour(wrappedHour);
    setSelectedMinute(wrappedMinute);

    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const isoValue = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(wrappedHour).padStart(2, '0')}:${String(wrappedMinute).padStart(2, '0')}`;
        onChange(isoValue);
      }
    }
  };

  const adjustTime = (type: 'hours' | 'minutes', delta: number) => {
    let hour = selectedHour;
    let minute = selectedMinute;

    if (editingHours !== null) {
      const parsed = parseInt(editingHours, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 23) hour = parsed;
      setEditingHours(null);
    }
    if (editingMinutes !== null) {
      const parsed = parseInt(editingMinutes, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 59) minute = parsed;
      setEditingMinutes(null);
    }

    if (type === 'hours') {
      handleTimeChange(hour + delta, minute);
    } else {
      handleTimeChange(hour, minute + delta);
    }
  };

  const closePicker = () => {
    setShowCalendar(false);
    setShowTimePicker(false);
    setEditingHours(null);
    setEditingMinutes(null);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const monthNames = [
    t('common:january', { defaultValue: 'Janvier' }),
    t('common:february', { defaultValue: 'Février' }),
    t('common:march', { defaultValue: 'Mars' }),
    t('common:april', { defaultValue: 'Avril' }),
    t('common:may', { defaultValue: 'Mai' }),
    t('common:june', { defaultValue: 'Juin' }),
    t('common:july', { defaultValue: 'Juillet' }),
    t('common:august', { defaultValue: 'Août' }),
    t('common:september', { defaultValue: 'Septembre' }),
    t('common:october', { defaultValue: 'Octobre' }),
    t('common:november', { defaultValue: 'Novembre' }),
    t('common:december', { defaultValue: 'Décembre' }),
  ];

  const dayNames = [
    t('common:mon', { defaultValue: 'Lun' }),
    t('common:tue', { defaultValue: 'Mar' }),
    t('common:wed', { defaultValue: 'Mer' }),
    t('common:thu', { defaultValue: 'Jeu' }),
    t('common:fri', { defaultValue: 'Ven' }),
    t('common:sat', { defaultValue: 'Sam' }),
    t('common:sun', { defaultValue: 'Dim' }),
  ];

  const selectedDate = value ? new Date(value) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const stepperBtnClass = isCompact
    ? 'w-8 h-7 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors'
    : 'w-10 h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

  const stepperValueClass = isCompact
    ? 'w-12 h-10 flex items-center justify-center text-base font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums'
    : 'w-16 h-12 flex items-center justify-center text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums';

  const stepperValueEditingClass = isCompact
    ? 'w-12 h-10 text-center text-base font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
    : 'w-16 h-12 text-center text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  const chevronUp = (
    <svg className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
  const chevronDown = (
    <svg className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  const calendarPanel =
    (showCalendar || showTimePicker) &&
    createPortal(
      <div
        ref={calendarRef}
        className={`fixed z-[9999] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl ${
          isCompact ? 'p-3' : 'p-4'
        }`}
        style={calendarStyle}
      >
        {showCalendar && (
          <>
            <div className={`flex items-center justify-between ${isCompact ? 'mb-2' : 'mb-4'}`}>
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                className={`${isCompact ? 'p-1' : 'p-1.5'} hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
                aria-label={t('common:previousMonth', { defaultValue: 'Mois précédent' })}
              >
                <ChevronLeft className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-gray-600 dark:text-gray-400`} />
              </button>
              <h3 className={`${isCompact ? 'text-sm' : 'text-base'} font-semibold text-gray-900 dark:text-gray-100`}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                type="button"
                onClick={() => navigateMonth('next')}
                className={`${isCompact ? 'p-1' : 'p-1.5'} hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
                aria-label={t('common:nextMonth', { defaultValue: 'Mois suivant' })}
              >
                <ChevronRight className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-gray-600 dark:text-gray-400`} />
              </button>
            </div>

            <div className={`grid grid-cols-7 ${isCompact ? 'gap-0.5 mb-1' : 'gap-1 mb-2'}`}>
              {dayNames.map((day, index) => (
                <div
                  key={index}
                  className={`${isCompact ? 'text-[10px] py-1' : 'text-xs py-2'} text-center font-medium text-gray-500 dark:text-gray-400`}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className={`grid grid-cols-7 ${isCompact ? 'gap-0.5' : 'gap-1'}`}>
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={index} className={isCompact ? 'aspect-square' : 'aspect-square'} />;
                }

                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                date.setHours(0, 0, 0, 0);
                const isSelected =
                  selectedDate &&
                  selectedDate.getFullYear() === date.getFullYear() &&
                  selectedDate.getMonth() === date.getMonth() &&
                  selectedDate.getDate() === date.getDate();
                const isToday = date.getTime() === today.getTime();
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isDisabled =
                  Boolean(min && dateStr < min.split('T')[0]) || Boolean(max && dateStr > max.split('T')[0]);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => !isDisabled && handleDateSelect(day)}
                    disabled={isDisabled}
                    className={`
                      ${isCompact ? 'aspect-square text-xs' : 'aspect-square text-sm'}
                      rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${
                        isSelected
                          ? 'bg-blue-600 text-white font-semibold'
                          : isToday
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                            : isDisabled
                              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {showTime && (showTimePicker || (showCalendar && selectedDate)) && (
          <div className={`${showCalendar ? (isCompact ? 'mt-3 pt-3' : 'mt-4 pt-4') : ''} border-t border-gray-200 dark:border-gray-700`}>
            <div className={`flex items-center ${isCompact ? 'gap-2 mb-2' : 'gap-3 mb-3'}`}>
              <Clock className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-gray-500 dark:text-gray-400`} />
              <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-gray-700 dark:text-gray-300`}>
                {t('common:time', { defaultValue: 'Heure' })}
              </span>
            </div>

            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <label className={`mb-2 ${isCompact ? 'text-[10px]' : 'text-xs'} font-medium text-gray-500 dark:text-gray-400`}>
                  {t('common:hours', { defaultValue: 'Heures' })}
                </label>
                <div className="flex flex-col items-center gap-1">
                  <button type="button" className={stepperBtnClass} onClick={() => adjustTime('hours', 1)} aria-label={t('common:increaseHours', { defaultValue: 'Augmenter les heures' })}>
                    {chevronUp}
                  </button>
                  {editingHours !== null ? (
                    <input
                      ref={hoursInputRef}
                      type="number"
                      min={0}
                      max={23}
                      value={editingHours}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (val === '' || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 23)) {
                          setEditingHours(val);
                        }
                      }}
                      onBlur={() => {
                        const val = parseInt(editingHours, 10);
                        if (!Number.isNaN(val) && val >= 0 && val <= 23) {
                          handleTimeChange(val, selectedMinute);
                        }
                        setEditingHours(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        if (event.key === 'Escape') setEditingHours(null);
                      }}
                      className={stepperValueEditingClass}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className={stepperValueClass}
                      onClick={() => {
                        setEditingHours(String(selectedHour));
                        window.setTimeout(() => hoursInputRef.current?.select(), 0);
                      }}
                    >
                      {String(selectedHour).padStart(2, '0')}
                    </button>
                  )}
                  <button type="button" className={stepperBtnClass} onClick={() => adjustTime('hours', -1)} aria-label={t('common:decreaseHours', { defaultValue: 'Diminuer les heures' })}>
                    {chevronDown}
                  </button>
                </div>
              </div>

              <div className={`${isCompact ? 'text-xl' : 'text-2xl'} font-bold text-gray-400 dark:text-gray-500 mt-6`}>:</div>

              <div className="flex flex-col items-center">
                <label className={`mb-2 ${isCompact ? 'text-[10px]' : 'text-xs'} font-medium text-gray-500 dark:text-gray-400`}>
                  {t('common:minutes', { defaultValue: 'Minutes' })}
                </label>
                <div className="flex flex-col items-center gap-1">
                  <button type="button" className={stepperBtnClass} onClick={() => adjustTime('minutes', 1)} aria-label={t('common:increaseMinutes', { defaultValue: 'Augmenter les minutes' })}>
                    {chevronUp}
                  </button>
                  {editingMinutes !== null ? (
                    <input
                      ref={minutesInputRef}
                      type="number"
                      min={0}
                      max={59}
                      value={editingMinutes}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (val === '' || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)) {
                          setEditingMinutes(val);
                        }
                      }}
                      onBlur={() => {
                        const val = parseInt(editingMinutes, 10);
                        if (!Number.isNaN(val) && val >= 0 && val <= 59) {
                          handleTimeChange(selectedHour, val);
                        }
                        setEditingMinutes(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        if (event.key === 'Escape') setEditingMinutes(null);
                      }}
                      className={stepperValueEditingClass}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className={stepperValueClass}
                      onClick={() => {
                        setEditingMinutes(String(selectedMinute));
                        window.setTimeout(() => minutesInputRef.current?.select(), 0);
                      }}
                    >
                      {String(selectedMinute).padStart(2, '0')}
                    </button>
                  )}
                  <button type="button" className={stepperBtnClass} onClick={() => adjustTime('minutes', -1)} aria-label={t('common:decreaseMinutes', { defaultValue: 'Diminuer les minutes' })}>
                    {chevronDown}
                  </button>
                </div>
              </div>
            </div>

            <div className={`flex justify-center ${isCompact ? 'gap-1.5 mt-3' : 'gap-2 mt-4'}`}>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  handleTimeChange(now.getHours(), now.getMinutes());
                }}
                className={`${isCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
              >
                {t('common:currentTime', { defaultValue: 'Heure actuelle' })}
              </button>
              <button
                type="button"
                onClick={closePicker}
                className={`${isCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
              >
                {t('common:done', { defaultValue: 'Terminé' })}
              </button>
            </div>
          </div>
        )}
      </div>,
      document.body
    );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!disabled) {
              setShowCalendar(true);
              if (showTime && value) {
                setShowTimePicker(true);
              }
            }
          }}
          placeholder={
            placeholder ||
            (showTime
              ? t('common:dateTimePlaceholder', {
                  defaultValue: i18n.language === 'fr' ? 'JJ/MM/AAAA HH:MM' : 'DD/MM/YYYY HH:MM',
                })
              : t('common:datePlaceholder', {
                  defaultValue: i18n.language === 'fr' ? 'JJ/MM/AAAA' : 'DD/MM/YYYY',
                }))
          }
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          className={`w-full pr-10 ${className}`}
        />
        <button
          type="button"
          onClick={() => {
            if (!disabled) {
              setShowCalendar(!showCalendar);
              if (showTime && value) {
                setShowTimePicker(!showTimePicker);
              }
            }
          }}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label={t('common:openCalendar', { defaultValue: 'Ouvrir le calendrier' })}
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {calendarPanel}
    </div>
  );
};
