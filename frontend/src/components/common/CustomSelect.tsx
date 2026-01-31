import React, { useEffect, useRef, useState } from 'react';
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
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, minWidth: 0 });

  const currentOption = options.find(opt => opt.value === value) || options[0];

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
          // Créer un élément temporaire pour mesurer le texte
          const tempElement = document.createElement('span');
          tempElement.style.visibility = 'hidden';
          tempElement.style.position = 'absolute';
          tempElement.style.whiteSpace = 'nowrap';
          tempElement.style.fontSize = window.getComputedStyle(buttonRef.current).fontSize;
          tempElement.style.fontFamily = window.getComputedStyle(buttonRef.current).fontFamily;
          tempElement.style.padding = '0 12px'; // px-3
          document.body.appendChild(tempElement);
          
          let maxContentWidth = minWidth;
          options.forEach(opt => {
            tempElement.textContent = opt.label;
            const contentWidth = tempElement.offsetWidth;
            if (contentWidth > maxContentWidth) {
              maxContentWidth = contentWidth;
            }
          });
          
          document.body.removeChild(tempElement);
          
          // Utiliser le maximum entre la largeur minimale (bouton) et la largeur du contenu
          // Ajouter 40px de marge pour le padding et les bordures
          const finalWidth = Math.max(minWidth, maxContentWidth + 40);
          
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
            width: finalWidth,
            minWidth: minWidth,
          });
        }
      };
      
      // Attendre un tick pour que le DOM soit prêt
      setTimeout(updatePosition, 0);
      
      // Mettre à jour la position lors du scroll ou du resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [open, options]);

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
      className="fixed z-[9999] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-72 overflow-auto"
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
      <ul className="py-1 text-sm sm:text-base text-gray-700 dark:text-gray-300">
        {options.map((opt) => (
          <li key={opt.value ?? 'empty'}>
            <button
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`w-full flex items-center justify-start px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                opt.value === value ? 'bg-gray-50 dark:bg-gray-700' : ''
              }`}
            >
              <span className="text-gray-900 dark:text-gray-100 whitespace-nowrap">{opt.label}</span>
            </button>
          </li>
        ))}
      </ul>
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

