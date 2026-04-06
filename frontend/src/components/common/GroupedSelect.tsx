import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface SelectOption {
  value: string | number | null;
  label: string;
}

interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface GroupedSelectProps {
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  groups: SelectGroup[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const GroupedSelect: React.FC<GroupedSelectProps> = ({
  value,
  onChange,
  groups,
  placeholder,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, minWidth: 0 });

  // Trouver l'option sélectionnée dans tous les groupes
  const currentOption = groups
    .flatMap(group => group.options)
    .find(opt => opt.value === value);

  const toggleDropdown = () => {
    setOpen(prev => !prev);
  };

  const handleSelect = (selectedValue: string | number | null) => {
    onChange(selectedValue);
    setOpen(false);
  };

  // Calculer la position et la largeur du dropdown
  useEffect(() => {
    if (open && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current && dropdownMenuRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const minWidth = rect.width;
          
          // Calculer la largeur nécessaire pour le contenu le plus long
          const tempElement = document.createElement('span');
          tempElement.style.visibility = 'hidden';
          tempElement.style.position = 'absolute';
          tempElement.style.whiteSpace = 'nowrap';
          tempElement.style.fontSize = window.getComputedStyle(buttonRef.current).fontSize;
          tempElement.style.fontFamily = window.getComputedStyle(buttonRef.current).fontFamily;
          tempElement.style.padding = '0 12px';
          document.body.appendChild(tempElement);
          
          let maxContentWidth = minWidth;
          groups.forEach(group => {
            group.options.forEach(opt => {
              tempElement.textContent = opt.label;
              const contentWidth = tempElement.offsetWidth;
              if (contentWidth > maxContentWidth) {
                maxContentWidth = contentWidth;
              }
            });
          });
          
          document.body.removeChild(tempElement);
          
          const finalWidth = Math.max(minWidth, maxContentWidth + 40);
          
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: finalWidth,
            minWidth: minWidth,
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
  }, [open, groups]);

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
      className="fixed z-[9999] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-96 overflow-auto"
      style={{
        '--dropdown-top': `${dropdownPosition.top}px`,
        '--dropdown-left': `${dropdownPosition.left}px`,
        '--dropdown-width': `${dropdownPosition.width}px`,
        '--dropdown-min-width': `${dropdownPosition.minWidth}px`,
        top: 'var(--dropdown-top)',
        left: 'var(--dropdown-left)',
        width: 'var(--dropdown-width)',
        minWidth: 'var(--dropdown-min-width)',
      } as React.CSSProperties}
    >
      <div className="py-1">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* En-tête du groupe */}
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900">
              {group.label}
            </div>
            {/* Options du groupe */}
            <ul className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
              {group.options.map((opt) => (
                <li key={opt.value ?? 'empty'}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-start px-4 sm:px-5 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      opt.value === value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''
                    }`}
                  >
                    <span className="whitespace-nowrap">{opt.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            {/* Séparateur entre groupes (sauf pour le dernier) */}
            {groupIndex < groups.length - 1 && (
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div ref={dropdownRef} className={`relative ${className}`}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={toggleDropdown}
          className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-gray-900 dark:text-gray-100">
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
