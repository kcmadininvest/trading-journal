import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SelectOption {
  value: string | number | null;
  label: string;
}

interface CustomSelectProps {
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Largeur plafonnée + texte tronqué (barres de filtres denses) */
  variant?: 'default' | 'compact';
  searchable?: boolean;
  searchPlaceholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
  variant = 'default',
  searchable = false,
  searchPlaceholder = 'Rechercher...',
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    minWidth: 0,
    maxHeight: 288,
    placement: 'bottom' as 'bottom' | 'top',
  });

  const optionMatchesValue = (optVal: string | number | null, val: string | number | null) =>
    optVal === val ||
    (val != null &&
      optVal != null &&
      typeof optVal !== 'boolean' &&
      typeof val !== 'boolean' &&
      String(optVal) === String(val));

  const currentOption = options.find(opt => optionMatchesValue(opt.value, value)) || options[0];
  const normalizeText = (input: string) =>
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const normalizedQuery = normalizeText(searchTerm);
    return options.filter(opt => normalizeText(opt.label).includes(normalizedQuery));
  }, [options, searchTerm, searchable]);

  const toggleDropdown = () => {
    setOpen(prev => {
      const next = !prev;
      if (!next) {
        setSearchTerm('');
      }
      return next;
    });
  };

  const handleSelect = (selectedValue: string | number | null) => {
    onChange(selectedValue);
    setSearchTerm('');
    setOpen(false);
  };

  // Calculer la position, la largeur et la hauteur max selon le viewport (comme AccountSelector / PeriodSelector)
  useEffect(() => {
    if (open && buttonRef.current) {
      const updatePosition = () => {
        if (!buttonRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        const minWidth = rect.width;
        const viewportMargin = 16;
        const minDropdownHeight = 120;

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
          if (contentWidth > maxContentWidth) {
            maxContentWidth = contentWidth;
          }
        });

        document.body.removeChild(tempElement);

        const maxViewportWidth = window.innerWidth - viewportMargin * 2;
        const idealWidth = Math.max(minWidth, maxContentWidth + 40);
        const finalWidth = Math.min(idealWidth, maxViewportWidth);
        const left = Math.max(
          viewportMargin,
          Math.min(rect.left, window.innerWidth - finalWidth - viewportMargin),
        );

        const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
        const spaceAbove = rect.top - viewportMargin;
        let placement: 'bottom' | 'top' = 'bottom';
        let maxHeight = Math.max(minDropdownHeight, spaceBelow);
        let top = rect.bottom + 4;

        if (spaceBelow < minDropdownHeight && spaceAbove > spaceBelow) {
          placement = 'top';
          maxHeight = Math.max(minDropdownHeight, spaceAbove);
          top = rect.top - 4;
        } else if (spaceBelow < spaceAbove) {
          maxHeight = Math.max(minDropdownHeight, Math.max(spaceBelow, spaceAbove));
          if (spaceAbove > spaceBelow) {
            placement = 'top';
            top = rect.top - 4;
          }
        }

        setDropdownPosition({
          top,
          left,
          width: finalWidth,
          minWidth,
          maxHeight,
          placement,
        });
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
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [open, searchable]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (open && 
          dropdownRef.current && 
          !dropdownRef.current.contains(target) &&
          dropdownMenuRef.current &&
          !dropdownMenuRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const dropdownContent = open && (
    <div
      ref={dropdownMenuRef}
      className="fixed z-[9999] overflow-y-auto overflow-x-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        minWidth: `${dropdownPosition.minWidth}px`,
        maxHeight: `${dropdownPosition.maxHeight}px`,
        ...(dropdownPosition.placement === 'top' ? { transform: 'translateY(-100%)' } : {}),
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
        {filteredOptions.map((opt) => (
          <li key={opt.value ?? 'empty'}>
            <button
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`flex w-full items-start justify-start px-2 py-1.5 sm:px-3 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                optionMatchesValue(opt.value, value) ? 'bg-gray-50 dark:bg-gray-700' : ''
              }`}
            >
              <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug text-gray-900 dark:text-gray-100">
                {opt.label}
              </span>
            </button>
          </li>
        ))}
        {filteredOptions.length === 0 && (
          <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            No results
          </li>
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
          <span className="min-w-0 flex-1 truncate text-left text-gray-900 dark:text-gray-100">
            {currentOption?.label || placeholder || ''}
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

