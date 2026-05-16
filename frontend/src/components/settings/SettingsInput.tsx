import React, { useState } from 'react';

interface SettingsInputProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  /** floating = label dans le champ ; above = label au-dessus (compatible placeholder) */
  labelVariant?: 'floating' | 'above';
  required?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  helperText?: string;
  error?: string;
  className?: string;
}

export const SettingsInput: React.FC<SettingsInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  labelVariant = 'floating',
  required = false,
  disabled = false,
  icon,
  helperText,
  error,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== '' && value !== null && value !== undefined;
  const useAboveLabel = labelVariant === 'above';

  const inputClassName = `
    w-full px-4 py-3 text-sm
    ${icon ? 'pl-11' : ''}
    border rounded-lg
    bg-white dark:bg-gray-800
    text-gray-900 dark:text-gray-100
    placeholder-gray-400 dark:placeholder-gray-500
    transition-all duration-200
    ${error
      ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/30'
      : isFocused
        ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900/30'
        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
    }
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    focus:outline-none
  `;

  if (useAboveLabel) {
    return (
      <div className={className}>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              {icon}
            </div>
          )}
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={inputClassName}
            autoComplete={type === 'password' ? 'off' : undefined}
          />
        </div>
        {(helperText || error) && (
          <p
            className={`mt-1.5 text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}

        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={inputClassName}
        />

        <label
          className={`
            pointer-events-none absolute transition-all duration-200
            ${icon ? 'left-11' : 'left-3'}
            ${isFocused || hasValue
              ? '-top-2 bg-white px-1 text-xs dark:bg-gray-800'
              : 'top-1/2 -translate-y-1/2 text-sm'
            }
            ${error
              ? 'text-red-600 dark:text-red-400'
              : isFocused
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400'
            }
          `}
        >
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      </div>

      {(helperText || error) && (
        <p
          className={`mt-1.5 text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};
