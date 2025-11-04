import React, { useMemo } from 'react';
import { User } from '../../services/auth';
import { authService } from '../../services/auth';
import { Tooltip } from '../ui';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
  currentUser: User;
  currentPage: string;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, currentPage, onLogout }) => {
  const { t } = useI18nTranslation();
  const { theme, setTheme } = useTheme();
  
  const pageTitle = useMemo(() => {
    const titles: { [key: string]: string } = {
      dashboard: t('navigation:dashboard'),
      calendar: t('navigation:calendar'),
      trades: t('navigation:trades'),
      statistics: t('navigation:statistics'),
      strategies: t('navigation:strategies'),
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
