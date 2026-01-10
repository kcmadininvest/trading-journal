import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MetricGroupProps {
  title: string;
  subtitle?: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const MetricGroup: React.FC<MetricGroupProps> = ({
  title,
  subtitle,
  defaultCollapsed = false,
  children,
  className = '',
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`mb-8 ${className}`}>
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        className="mb-4 flex items-center justify-between w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 group relative overflow-hidden cursor-default"
      >
        {/* Barre indicatrice à gauche */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        
        <div className="flex-1 text-left">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
            {title}
          </h2>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <span className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
            {isCollapsed ? t('common:show', { defaultValue: 'Afficher' }) : t('common:hide', { defaultValue: 'Masquer' })}
          </span>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
            <svg
              className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-250 ${isCollapsed ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>
      
      {/* Contenu avec animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'
        }`}
      >
        <div className="pt-2">
          {children}
        </div>
      </div>
    </div>
  );
};

