import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TimeInputProps {
  /** Format HH:mm, ou chaîne vide. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  compact?: boolean;
  'aria-label'?: string;
  title?: string;
}

function parseHHmm(raw: string): { hours: number; minutes: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function formatHHmm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Saisie d'heure (HH:mm) alignée sur le picker de DateTimeInput
 * (texte libre + steppers heures/minutes).
 */
export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false,
  id,
  name,
  compact = false,
  'aria-label': ariaLabel,
  title,
}) => {
  const { t } = useTranslation(['common']);
  const [showPicker, setShowPicker] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(30);
  const [editingHours, setEditingHours] = useState<string | null>(null);
  const [editingMinutes, setEditingMinutes] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const [pickerStyle, setPickerStyle] = useState<{
    top?: string;
    left?: string;
    width?: string;
    maxHeight?: string;
  }>({});

  const isCompact = compact || className.includes('text-xs') || className.includes('text-sm');

  useEffect(() => {
    const parsed = parseHHmm(value);
    setInputValue(parsed ? formatHHmm(parsed.hours, parsed.minutes) : value || '');
    if (parsed) {
      setSelectedHour(parsed.hours);
      setSelectedMinute(parsed.minutes);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        pickerRef.current &&
        !pickerRef.current.contains(target)
      ) {
        setShowPicker(false);
        setEditingHours(null);
        setEditingMinutes(null);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  useEffect(() => {
    if (!showPicker || !containerRef.current) return;

    const calculatePosition = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const measuredHeight = pickerRef.current?.offsetHeight;
      const pickerHeight = measuredHeight && measuredHeight > 0 ? measuredHeight : isCompact ? 220 : 260;
      const pickerWidth = isCompact ? 220 : 260;
      const gap = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spaceRight = viewportWidth - containerRect.right - gap;
      const spaceLeft = containerRect.left - gap;

      let left: number;
      if (spaceRight >= pickerWidth || spaceRight >= spaceLeft) {
        left = Math.min(containerRect.right + gap, viewportWidth - pickerWidth - gap);
        if (left < gap) left = gap;
      } else {
        left = Math.max(gap, containerRect.left - pickerWidth - gap);
      }

      const maxTop = Math.max(gap, viewportHeight - pickerHeight - gap);
      const top = Math.min(Math.max(gap, containerRect.top), maxTop);

      setPickerStyle({
        top: `${top}px`,
        left: `${left}px`,
        width: `${pickerWidth}px`,
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
  }, [showPicker, isCompact, selectedHour, selectedMinute]);

  const commitTime = useCallback(
    (hours: number, minutes: number) => {
      const wrappedHour = ((hours % 24) + 24) % 24;
      const wrappedMinute = ((minutes % 60) + 60) % 60;
      setSelectedHour(wrappedHour);
      setSelectedMinute(wrappedMinute);
      const next = formatHHmm(wrappedHour, wrappedMinute);
      setInputValue(next);
      onChange(next);
    },
    [onChange],
  );

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
      commitTime(hour + delta, minute);
    } else {
      commitTime(hour, minute + delta);
    }
  };

  const closePicker = () => {
    setShowPicker(false);
    setEditingHours(null);
    setEditingMinutes(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setInputValue(next);
    const parsed = parseHHmm(next);
    if (parsed) {
      commitTime(parsed.hours, parsed.minutes);
    } else if (!next.trim()) {
      onChange('');
    }
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      onChange('');
      setInputValue('');
      return;
    }
    const parsed = parseHHmm(inputValue);
    if (parsed) {
      const formatted = formatHHmm(parsed.hours, parsed.minutes);
      setInputValue(formatted);
      onChange(formatted);
    } else {
      const fromValue = parseHHmm(value);
      setInputValue(fromValue ? formatHHmm(fromValue.hours, fromValue.minutes) : '');
    }
  };

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

  const pickerPanel =
    showPicker &&
    createPortal(
      <div
        ref={pickerRef}
        className={`fixed z-[9999] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl ${
          isCompact ? 'p-3' : 'p-4'
        }`}
        style={pickerStyle}
      >
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
              <button
                type="button"
                className={stepperBtnClass}
                onClick={() => adjustTime('hours', 1)}
                aria-label={t('common:increaseHours', { defaultValue: 'Augmenter les heures' })}
              >
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
                      commitTime(val, selectedMinute);
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
              <button
                type="button"
                className={stepperBtnClass}
                onClick={() => adjustTime('hours', -1)}
                aria-label={t('common:decreaseHours', { defaultValue: 'Diminuer les heures' })}
              >
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
              <button
                type="button"
                className={stepperBtnClass}
                onClick={() => adjustTime('minutes', 1)}
                aria-label={t('common:increaseMinutes', { defaultValue: 'Augmenter les minutes' })}
              >
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
                      commitTime(selectedHour, val);
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
              <button
                type="button"
                className={stepperBtnClass}
                onClick={() => adjustTime('minutes', -1)}
                aria-label={t('common:decreaseMinutes', { defaultValue: 'Diminuer les minutes' })}
              >
                {chevronDown}
              </button>
            </div>
          </div>
        </div>

        <div className={`flex justify-center ${isCompact ? 'gap-1.5 mt-3' : 'gap-2 mt-4'}`}>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setInputValue('');
              closePicker();
            }}
            className={`${isCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
          >
            {t('common:clear', { defaultValue: 'Effacer' })}
          </button>
          <button
            type="button"
            onClick={closePicker}
            className={`${isCompact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
          >
            {t('common:done', { defaultValue: 'Terminé' })}
          </button>
        </div>
      </div>,
      document.body,
    );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          id={id}
          name={name}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onFocus={() => {
            if (!disabled) setShowPicker(true);
          }}
          placeholder={placeholder || t('common:timePlaceholder', { defaultValue: 'HH:MM' })}
          disabled={disabled}
          aria-label={ariaLabel}
          title={title}
          className={`w-full pr-10 tabular-nums ${className}`}
        />
        <button
          type="button"
          onClick={() => {
            if (!disabled) setShowPicker(!showPicker);
          }}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label={t('common:openTimePicker', { defaultValue: 'Ouvrir le sélecteur d’heure' })}
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>
      {pickerPanel}
    </div>
  );
};
