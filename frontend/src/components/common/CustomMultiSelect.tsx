import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SelectOption {
  value: string;
  label: string;
}

interface CustomMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Libellé quand plusieurs valeurs sont sélectionnées (ex. « 3 instruments »). */
  selectedCountLabel?: (count: number) => string;
  /** Libellé du bouton pour effacer la sélection. */
  clearLabel?: string;
}

export const CustomMultiSelect: React.FC<CustomMultiSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '',
  disabled = false,
  className = '',
  variant = 'default',
  searchable = false,
  searchPlaceholder = 'Rechercher...',
  selectedCountLabel,
  clearLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, minWidth: 0 });

  const selectedSet = useMemo(() => new Set(value), [value]);

  const normalizeText = (input: string) =>
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const normalizedQuery = normalizeText(searchTerm);
    return options.filter((opt) => normalizeText(opt.label).includes(normalizedQuery));
  }, [options, searchTerm, searchable]);

  const buttonLabel = useMemo(() => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) {
      const opt = options.find((o) => o.value === value[0]);
      return opt?.label ?? value[0];
    }
    if (selectedCountLabel) return selectedCountLabel(value.length);
    return `${value.length}`;
  }, [value, options, placeholder, selectedCountLabel]);

  const toggleDropdown = () => {
    setOpen((prev) => {
      const next = !prev;
      if (!next) setSearchTerm('');
      return next;
    });
  };

  const toggleValue = useCallback(
    (selectedValue: string) => {
      if (selectedSet.has(selectedValue)) {
        onChange(value.filter((v) => v !== selectedValue));
      } else {
        onChange([...value, selectedValue]);
      }
    },
    [onChange, selectedSet, value]
  );

  const clearAll = () => {
    onChange([]);
    setSearchTerm('');
  };

  useEffect(() => {
    if (open && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current && dropdownMenuRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const minWidth = rect.width;

          const tempElement = document.createElement('span');
          tempElement.style.visibility = 'hidden';
          tempElement.style.position = 'absolute';
          tempElement.style.whiteSpace = 'nowrap';
          tempElement.style.fontSize = window.getComputedStyle(buttonRef.current).fontSize;
          tempElement.style.fontFamily = window.getComputedStyle(buttonRef.current).fontFamily;
          tempElement.style.padding = '0 12px';
          document.body.appendChild(tempElement);

          let maxContentWidth = minWidth;
          options.forEach((opt) => {
            tempElement.textContent = opt.label;
            const contentWidth = tempElement.offsetWidth;
            if (contentWidth > maxContentWidth) maxContentWidth = contentWidth;
          });
          document.body.removeChild(tempElement);

          const finalWidth = Math.max(minWidth, maxContentWidth + 56);

          setDropdownPosition({
            top: rect.bottom + 4,
            left: rect.left,
            width: finalWidth,
            minWidth,
          });
        }
      };

      setTimeout(updatePosition, 0);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open, options]);

  useEffect(() => {
    if (open && searchable) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        open &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const dropdownContent = open && (
    <div
      ref={dropdownMenuRef}
      className="fixed z-[9999] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-72 overflow-auto"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        minWidth: `${dropdownPosition.minWidth}px`,
      }}
    >
      <ul className="py-1 text-sm sm:text-base text-gray-700 dark:text-gray-300">
        {searchable && (
          <li className="px-2 py-1 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </li>
        )}
        {value.length > 0 && (
          <li className="border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={clearAll}
              className="w-full px-3 py-1.5 text-left text-xs font-medium text-blue-600 hover:bg-gray-50 dark:text-blue-400 dark:hover:bg-gray-700"
            >
              {clearLabel ?? placeholder}
            </button>
          </li>
        )}
        {filteredOptions.map((opt) => {
          const checked = selectedSet.has(opt.value);
          return (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => toggleValue(opt.value)}
                className={`w-full flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  checked ? 'bg-gray-50 dark:bg-gray-700/80' : ''
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                      : 'border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-700'
                  }`}
                  aria-hidden
                >
                  {checked && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="text-gray-900 dark:text-gray-100 whitespace-nowrap">{opt.label}</span>
              </button>
            </li>
          );
        })}
        {filteredOptions.length === 0 && (
          <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No results</li>
        )}
      </ul>
    </div>
  );

  const rootClass =
    variant === 'compact'
      ? `relative w-full min-w-0 max-w-[240px] ${className}`.trim()
      : `relative ${className}`.trim();

  return (
    <>
      <div ref={dropdownRef} className={rootClass}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={toggleDropdown}
          className="w-full min-w-0 h-10 inline-flex items-center justify-between gap-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span
            className={`min-w-0 flex-1 truncate text-left ${
              value.length === 0 ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {buttonLabel}
          </span>
          <svg
            className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </>
  );
};
