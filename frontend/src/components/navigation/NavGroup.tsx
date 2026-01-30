import React, { useState, useRef, useEffect } from 'react';
import NavItem from './NavItem';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ReactElement;
  visible: boolean;
}

interface NavGroupProps {
  label: string;
  items: NavItemConfig[];
  currentPage: string;
  onNavigate: (page: string) => void;
  icon?: React.ReactElement;
}

const NavGroup: React.FC<NavGroupProps> = ({ label, items, currentPage, onNavigate, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const visibleItems = items.filter(item => item.visible);
  const hasActiveItem = visibleItems.some(item => item.id === currentPage);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current as unknown as number);
      }
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current as unknown as number);
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current as unknown as number);
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsOpen(false);
  };

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div 
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          hasActiveItem
            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
            : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {icon && (
          <span className="flex-shrink-0 w-4 h-4">
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 min-w-[200px] bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="py-2 px-2 space-y-1">
            {visibleItems.map((item) => (
              <NavItem
                key={item.id}
                id={item.id}
                label={item.label}
                icon={item.icon}
                isActive={currentPage === item.id}
                onClick={handleNavigate}
                className="w-full justify-start"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavGroup;
