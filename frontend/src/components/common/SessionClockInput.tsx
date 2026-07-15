import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { replayDateInputClass } from '../replay/replayStyles';

export const SESSION_CLOCK_COLUMN_WIDTH = '7rem';

/** Grille : libellé | début | fin | action */
export const MARKET_PHASE_PERIOD_FORM_GRID_CLASS =
  'grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]';

export const MARKET_PHASE_FORM_LABEL_CLASS =
  'mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300';

export const MARKET_PHASE_FORM_FIELD_HEIGHT_CLASS = '!h-9 !min-h-9 !max-h-9';

export const MARKET_PHASE_FORM_CONTROL_CLASS =
  `${replayDateInputClass} box-border ${MARKET_PHASE_FORM_FIELD_HEIGHT_CLASS} !py-0 !leading-none text-xs`;

export const MARKET_PHASE_FORM_CLOCK_CLASS =
  `${MARKET_PHASE_FORM_FIELD_HEIGHT_CLASS} !py-0 !leading-none text-xs`;

export const MARKET_PHASE_FORM_BUTTON_CLASS =
  `inline-flex w-full items-center justify-center box-border rounded-md bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 ${MARKET_PHASE_FORM_FIELD_HEIGHT_CLASS} !py-0 !leading-none`;

/** @deprecated Préférer la grille MARKET_PHASE_PERIOD_FORM_GRID_CLASS */
export const SESSION_CLOCK_FIELD_CLASS = 'min-w-0 w-full overflow-hidden';

export const SESSION_CLOCK_FIELD_STYLE: React.CSSProperties = {
  width: SESSION_CLOCK_COLUMN_WIDTH,
  minWidth: SESSION_CLOCK_COLUMN_WIDTH,
  maxWidth: SESSION_CLOCK_COLUMN_WIDTH,
};

export interface SessionClockInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  minTime?: string;
}

function timeToMinutes(hhmm: string): number | null {
  const parsed = parseSessionClock(hhmm);
  if (!parsed) return null;
  const [h, m] = parsed.split(':').map((part) => parseInt(part, 10));
  return h * 60 + m;
}

export function parseSessionClock(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatSessionClockDisplay(value: string): string {
  return parseSessionClock(value) ?? value;
}

interface ClockParts {
  hours: number;
  minutes: number;
}

function partsFromValue(value: string): ClockParts {
  const parsed = parseSessionClock(value);
  if (parsed) {
    const [h, m] = parsed.split(':').map((part) => parseInt(part, 10));
    return { hours: h, minutes: m };
  }
  const now = new Date();
  return { hours: now.getHours(), minutes: now.getMinutes() };
}

function partsToClock({ hours, minutes }: ClockParts): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const stepperBtnClass =
  'w-10 h-8 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

const stepperValueClass =
  'w-16 h-12 flex items-center justify-center text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums';

const stepperValueEditingClass =
  'w-16 h-12 text-center text-lg font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums';

export const SessionClockInput: React.FC<SessionClockInputProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
  placeholder = 'HH:mm',
  minTime,
}) => {
  const { t } = useTranslation('common');
  const [displayValue, setDisplayValue] = useState(formatSessionClockDisplay(value));
  const [isFocused, setIsFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingHours, setEditingHours] = useState<string | null>(null);
  const [editingMinutes, setEditingMinutes] = useState<string | null>(null);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);

  const commitValue = useCallback(
    (nextRaw: string, options?: { enforceMin?: boolean }) => {
      const enforceMin = options?.enforceMin !== false;
      const parsed = parseSessionClock(nextRaw);
      if (!parsed) {
        if (!nextRaw.trim()) {
          onChange('');
          setDisplayValue('');
        }
        return false;
      }

      if (enforceMin) {
        const minMinutes = minTime ? timeToMinutes(minTime) : null;
        const nextMinutes = timeToMinutes(parsed);
        if (minMinutes != null && nextMinutes != null && nextMinutes < minMinutes) {
          onChange(minTime!);
          setDisplayValue(minTime!);
          return true;
        }
      }

      onChange(parsed);
      setDisplayValue(parsed);
      return true;
    },
    [minTime, onChange],
  );

  const getCurrentParts = useCallback((): ClockParts => partsFromValue(value || displayValue), [displayValue, value]);

  const updateParts = useCallback(
    (hours: number, minutes: number, options?: { enforceMin?: boolean }) => {
      const wrappedHours = ((hours % 24) + 24) % 24;
      const wrappedMinutes = ((minutes % 60) + 60) % 60;
      commitValue(partsToClock({ hours: wrappedHours, minutes: wrappedMinutes }), options);
    },
    [commitValue],
  );

  const adjustParts = useCallback(
    (type: 'hours' | 'minutes', delta: number) => {
      const { hours, minutes } = getCurrentParts();
      // Pas de clamp minTime sur le stepper : sinon les flèches « bas » semblent HS
      // quand la valeur affichée est déjà au plancher (ex. fin vide = maintenant ≈ début).
      if (type === 'hours') {
        updateParts(hours + delta, minutes, { enforceMin: false });
      } else {
        updateParts(hours, minutes + delta, { enforceMin: false });
      }
    },
    [getCurrentParts, updateParts],
  );

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatSessionClockDisplay(value));
    }
  }, [isFocused, value]);

  useEffect(() => {
    if (!pickerOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 240),
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target)
        || pickerRef.current?.contains(target)
      ) {
        return;
      }
      setPickerOpen(false);
      setEditingHours(null);
      setEditingMinutes(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pickerOpen]);

  const handleBlur = () => {
    window.setTimeout(() => {
      if (pickerRef.current?.contains(document.activeElement)) return;
      setIsFocused(false);
      if (!displayValue.trim()) {
        onChange('');
        setDisplayValue('');
        return;
      }
      if (!commitValue(displayValue)) {
        setDisplayValue(formatSessionClockDisplay(value));
      }
    }, 120);
  };

  const inputClass =
    `${replayDateInputClass} block w-full min-w-0 max-w-full box-border !pr-10 tabular-nums ${className}`.trim();

  const pickerContent = pickerOpen && (
    <div
      ref={pickerRef}
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-[9999] rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{
        top: pickerPosition.top,
        left: pickerPosition.left,
        width: pickerPosition.width,
      }}
    >
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center">
          <label className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('hours', { defaultValue: 'Heures' })}
          </label>
          <div className="flex flex-col items-center gap-1">
            <button type="button" className={stepperBtnClass} onClick={() => adjustParts('hours', 1)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
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
                    const { minutes } = getCurrentParts();
                    updateParts(val, minutes);
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
                  setEditingHours(String(getCurrentParts().hours));
                  window.setTimeout(() => hoursInputRef.current?.select(), 0);
                }}
              >
                {String(getCurrentParts().hours).padStart(2, '0')}
              </button>
            )}
            <button type="button" className={stepperBtnClass} onClick={() => adjustParts('hours', -1)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-6 text-2xl font-bold text-gray-400 dark:text-gray-500">:</div>

        <div className="flex flex-col items-center">
          <label className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('minutes', { defaultValue: 'Minutes' })}
          </label>
          <div className="flex flex-col items-center gap-1">
            <button type="button" className={stepperBtnClass} onClick={() => adjustParts('minutes', 1)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
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
                    const { hours } = getCurrentParts();
                    updateParts(hours, val);
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
                  setEditingMinutes(String(getCurrentParts().minutes));
                  window.setTimeout(() => minutesInputRef.current?.select(), 0);
                }}
              >
                {String(getCurrentParts().minutes).padStart(2, '0')}
              </button>
            )}
            <button type="button" className={stepperBtnClass} onClick={() => adjustParts('minutes', -1)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => {
            const parts = getCurrentParts();
            updateParts(parts.hours, parts.minutes, { enforceMin: true });
            setPickerOpen(false);
            setEditingHours(null);
            setEditingMinutes(null);
          }}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t('done', { defaultValue: 'Terminé' })}
        </button>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative block w-full max-w-full min-w-0">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClass}
        onChange={(event) => setDisplayValue(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <button
        ref={toggleRef}
        type="button"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setPickerOpen((open) => !open)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none disabled:opacity-50 dark:hover:text-gray-300"
        aria-label={t('selectTime', { defaultValue: 'Choisir une heure' })}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
      {pickerOpen && typeof document !== 'undefined' && createPortal(pickerContent, document.body)}
    </div>
  );
};

export default SessionClockInput;
