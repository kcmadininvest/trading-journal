import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User } from '../../services/auth';
import { authService } from '../../services/auth';
import { Tooltip } from '../ui';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { changeLanguage } from '../../i18n/config';

interface HeaderProps {
  currentUser: User;
  currentPage: string;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, currentPage, onLogout }) => {
  const { t, i18n } = useI18nTranslation();
  const { theme, setTheme } = useTheme();
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  
  const languageOptions = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
    { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { value: 'es', label: 'Español', flag: '🇪🇸' },
  ];

  const currentLanguage = i18n.language?.split('-')[0] || 'en';

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLanguageChange = (lang: string) => {
    changeLanguage(lang);
    setIsLanguageDropdownOpen(false);
  };
  
  const pageTitle = useMemo(() => {
    const titles: { [key: string]: string } = {
      dashboard: t('navigation:dashboard'),
      calendar: t('navigation:calendar'),
      trades: t('navigation:trades'),
      statistics: t('navigation:statistics'),
      strategies: t('navigation:strategies'),
      'position-strategies': t('navigation:positionStrategies'),
      analytics: t('navigation:analytics'),
      accounts: t('navigation:accounts'),
      users: t('navigation:users'),
      settings: t('navigation:settings'),
    };
    return titles[currentPage] || t('navigation:header.appName');
  }, [currentPage, t]);
  
  const pageDescription = useMemo(() => {
    if (currentPage === 'dashboard') {
      return t('navigation:header.dashboardDescription');
    }
    return `${t('navigation:header.managementPrefix')} ${pageTitle.toLowerCase()}`;
  }, [currentPage, pageTitle, t]);

  const handleLogout = () => {
    authService.logout();
    onLogout();
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 h-20 flex items-center">
      <div className="flex items-center justify-between px-6 w-full h-full">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {pageTitle}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {pageDescription}
          </p>
        </div>

        {/* User info and actions */}
        <div className="flex items-center space-x-4">
          {/* Language selector */}
          <div className="relative" ref={languageDropdownRef}>
            <Tooltip content={t('settings:language', { defaultValue: 'Language' })} position="left">
              <button
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="inline-flex items-center justify-center w-10 h-10 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                aria-label={t('settings:language', { defaultValue: 'Language' })}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </button>
            </Tooltip>
            
            {isLanguageDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleLanguageChange(option.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150 ${
                      currentLanguage === option.value 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 dark:border-blue-500' 
                        : ''
                    }`}
                  >
                    <span className="text-xl">{option.flag}</span>
                    <span className={`font-medium flex-1 ${
                      currentLanguage === option.value 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {option.label}
                    </span>
                    {currentLanguage === option.value && (
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <Tooltip content={theme === 'dark' ? t('settings:themeLight') : t('settings:themeDark')} position="left">
            <button
              onClick={(e) => {
                setTheme(theme === 'dark' ? 'light' : 'dark');
                e.currentTarget.blur();
              }}
              className="inline-flex items-center justify-center w-10 h-10 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus-visible:ring-2"
              aria-label={theme === 'dark' ? t('settings:themeLight') : t('settings:themeDark')}
            >
              {theme === 'dark' ? (
                // Sun icon for light mode
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                // Moon icon for dark mode
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </Tooltip>

          {/* User info */}
          <div className="text-right">
            <div className="flex items-center justify-end space-x-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {currentUser.first_name && currentUser.last_name 
                  ? `${currentUser.first_name} ${currentUser.last_name}` 
                  : currentUser.email}
              </p>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                currentUser.is_admin 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' 
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
              }`}>
                {currentUser.is_admin ? t('navigation:admin') : t('navigation:user')}
              </span>
            </div>
          </div>

          {/* Logout button */}
          <Tooltip content={t('navigation:header.logout')} position="left">
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center w-10 h-10 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
};

export default Header;
