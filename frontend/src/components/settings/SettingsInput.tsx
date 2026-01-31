import React, { useState } from 'react';

interface SettingsInputProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
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
  required = false,
  disabled = false,
  icon,
  helperText,
  error,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== '' && value !== null && value !== undefined;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {/* Icône à gauche */}
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5">
            {icon}
          </div>
        )}

        {/* Input */}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
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
          `}
        />

        {/* Label flottant */}
        <label
          className={`
            absolute transition-all duration-200 pointer-events-none
            ${icon ? 'left-11' : 'left-3'}
            ${isFocused || hasValue
              ? '-top-2 text-xs bg-white dark:bg-gray-800 px-1'
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
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>

      {/* Texte d'aide ou erreur */}
      {(helperText || error) && (
        <p className={`mt-1.5 text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};
