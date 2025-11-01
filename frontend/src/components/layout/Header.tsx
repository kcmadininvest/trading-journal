import React, { useMemo } from 'react';
import { User } from '../../services/auth';
import { authService } from '../../services/auth';
import { Tooltip } from '../ui';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface HeaderProps {
  currentUser: User;
  currentPage: string;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, currentPage, onLogout }) => {
  const { t } = useI18nTranslation();
  
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
    <header className="bg-white shadow-sm border-b border-gray-200 h-20">
      <div className="flex items-center justify-between px-6 h-full">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {pageTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {pageDescription}
          </p>
        </div>

        {/* User info and actions */}
        <div className="flex items-center space-x-4">
          {/* User info */}
          <div className="text-right">
            <div className="flex items-center justify-end space-x-2">
              <p className="text-sm font-medium text-gray-900">
                {currentUser.first_name && currentUser.last_name 
                  ? `${currentUser.first_name} ${currentUser.last_name}` 
                  : currentUser.email}
              </p>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                currentUser.is_admin 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {currentUser.is_admin ? t('navigation:admin') : t('navigation:user')}
              </span>
            </div>
          </div>

          {/* Logout button */}
          <Tooltip content={t('navigation:header.logout')} position="left">
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center w-10 h-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
