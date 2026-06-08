import React from 'react';
import { NumberInput } from './NumberInput';

interface NumberInputStepperProps {
  id?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  min?: number;
  max?: number;
  step?: string | number;
  digits?: number;
  required?: boolean;
  disabled?: boolean;
}

const STEPPER_BUTTON_CLASS =
  'flex flex-1 items-center justify-center text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200';

const STEPPER_CONTAINER_CLASS =
  'absolute right-1.5 top-1 bottom-1 flex w-6 flex-col overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800';

export const NumberInputStepper: React.FC<NumberInputStepperProps> = ({
  id,
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
  min,
  max,
  step = 1,
  digits = 2,
  required = false,
  disabled = false,
}) => {
  const stepValue = typeof step === 'string' ? parseFloat(step) : step;
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const hasValue = value !== '' && value !== null && value !== undefined && !Number.isNaN(numericValue);

  const adjust = (direction: 1 | -1) => {
    if (disabled || !stepValue || Number.isNaN(stepValue)) return;

    const base = hasValue ? numericValue : min ?? 0;
    let next = base + direction * stepValue;

    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);

    const decimals = String(step).includes('.') ? String(step).split('.')[1]?.length ?? digits : 0;
    onChange(decimals > 0 ? next.toFixed(decimals) : String(Math.round(next)));
  };

  const canIncrease = !disabled && (max === undefined || !hasValue || numericValue < max);
  const canDecrease = !disabled && (min === undefined || !hasValue || numericValue > min);

  return (
    <div className={`relative ${className}`}>
      <NumberInput
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${inputClassName} pr-10`}
        min={min}
        max={max}
        step={step}
        digits={digits}
        required={required}
        disabled={disabled}
      />
      <div className={STEPPER_CONTAINER_CLASS} aria-hidden={disabled}>
        <button
          type="button"
          tabIndex={-1}
          disabled={!canIncrease}
          onClick={() => adjust(1)}
          className={`${STEPPER_BUTTON_CLASS} border-b border-gray-200 dark:border-gray-600`}
          aria-label="Increase value"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={!canDecrease}
          onClick={() => adjust(-1)}
          className={STEPPER_BUTTON_CLASS}
          aria-label="Decrease value"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
};
