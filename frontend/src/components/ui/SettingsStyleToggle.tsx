import React from 'react';

/**
 * Interrupteur « pilule » aligné sur la page Paramètres (alertes email, pré-marché, thème).
 */
export function SettingsStyleToggle({
  pressed,
  onPressedChange,
  disabled,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      onClick={() => {
        if (!disabled) onPressedChange(!pressed);
      }}
      className={`relative ml-2 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
        pressed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          pressed ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
