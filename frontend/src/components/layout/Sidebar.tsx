import React, { useState } from 'react';
import { User } from '../../services/auth';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useApiStatus } from '../../hooks/useApiStatus';
import { VERSION } from '../../version';

interface SidebarProps {
  currentUser: User;
  currentPage: string;
  onNavigate: (page: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, currentPage, onNavigate, isCollapsed = false, onToggleCollapse }) => {
  const { t } = useI18nTranslation();
  const { status } = useApiStatus();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-400',
          text: t('common:apiStatus.online'),
          blink: false,
        };
      case 'offline':
        return {
          color: 'bg-red-400',
          text: t('common:apiStatus.offline'),
          blink: true,
        };
      case 'checking':
        return {
          color: 'bg-yellow-400',
          text: t('common:apiStatus.checking'),
          blink: true,
        };
      default:
        return {
          color: 'bg-gray-400',
          text: t('common:apiStatus.offline'),
          blink: true,
        };
    }
  };

  const statusConfig = getStatusConfig();
  const menuItems = [
    {
      id: 'dashboard',
      label: t('navigation:dashboard'),
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/>
        </svg>
      ),
      visible: true,
    },
    {
      id: 'calendar',
      label: t('navigation:calendar'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'strategies',
      label: t('navigation:strategies'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'position-strategies',
      label: t('navigation:positionStrategies', { defaultValue: 'Stratégies de Position' }),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'statistics',
      label: t('navigation:statistics'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'analytics',
      label: t('navigation:analytics'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'goals',
      label: t('navigation:goals', { defaultValue: 'Objectifs' }),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'trades',
      label: t('navigation:trades'),
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18l5-6 3 3 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      visible: true,
    },
    {
      id: 'accounts',
      label: t('navigation:accounts'),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'users',
      label: t('navigation:users'),
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      visible: currentUser.is_admin,
    },
        {
          id: 'settings',
          label: t('navigation:settings'),
          icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ),
          visible: true,
        },
  ];

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-3 left-3 sm:top-4 sm:left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-gray-900 dark:bg-gray-800 text-white p-2 sm:p-2.5 rounded-md shadow-lg hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
          aria-label={t('navigation:menu', { defaultValue: 'Menu' })}
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:sticky lg:top-0 lg:h-screen lg:max-h-screen left-0 z-50 bg-gray-900 text-white border-r border-gray-700 dark:border-gray-600 transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${isCollapsed ? 'w-20' : 'w-64 sm:w-72'} flex flex-col h-screen`}>
      {/* Logo */}
      <div className={`h-16 sm:h-20 flex items-center border-b border-gray-700 relative flex-shrink-0 ${isCollapsed ? 'px-3 sm:px-4 justify-center' : 'px-4 sm:px-6'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'justify-between w-full'}`}>
          <div className="flex items-center">
            {!isCollapsed && (
              <>
                {/* Close button for mobile */}
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="lg:hidden mr-3 p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                  aria-label={t('common:close', { defaultValue: 'Fermer' })}
                >
                  <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <h1 className="text-lg sm:text-xl font-bold whitespace-nowrap">Trading Journal</h1>
              </>
            )}
          </div>
          {/* Toggle button for desktop */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-700 transition-colors group ${isCollapsed ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : ''}`}
              aria-label={isCollapsed ? t('navigation:expand', { defaultValue: 'Déplier' }) : t('navigation:collapse', { defaultValue: 'Replier' })}
              style={{ cursor: 'default' }}
            >
              <svg
                className={`w-5 h-5 text-gray-300 group-hover:text-white transition-transform duration-250 ${isCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden mt-4 sm:mt-6 min-h-0">
        {!isCollapsed && (
          <div className="px-3 sm:px-4 sticky top-0 bg-gray-900 z-10 pt-2">
            <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
              {t('navigation:navigation')}
            </p>
          </div>
        )}
        <ul className={`space-y-1 ${isCollapsed ? 'px-2' : 'px-2 sm:px-3'} pb-4`}>
          {menuItems
            .filter(item => item.visible)
            .map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-2 sm:px-3'} py-2 sm:py-2.5 text-sm sm:text-base font-medium rounded-md transition-colors group relative ${
                    currentPage === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className={`${isCollapsed ? '' : 'mr-2 sm:mr-3'} flex-shrink-0`}>
                    {React.cloneElement(item.icon, { className: 'w-4 h-4 sm:w-5 sm:h-5' })}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  {/* Tooltip pour mode plié */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800 text-white text-xs sm:text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                      {item.label}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
                    </div>
                  )}
                </button>
              </li>
            ))}
        </ul>
      </nav>

      {/* API Status and Version */}
      <div className={`flex-shrink-0 ${isCollapsed ? 'w-20 px-2' : 'w-full px-3 sm:px-4'} py-3 sm:py-4 border-t border-gray-700`}>
        <div className={`flex flex-col ${isCollapsed ? 'items-center' : ''} space-y-1.5 sm:space-y-2`}>
          {/* API Status */}
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div 
                className={`w-2 h-2 ${statusConfig.color} rounded-full flex-shrink-0 ${
                  statusConfig.blink ? 'animate-pulse' : ''
                }`}
              ></div>
              <span className="text-[10px] sm:text-xs text-gray-400 truncate">{statusConfig.text}</span>
            </div>
          )}
          {isCollapsed && (
            <div 
              className={`w-2 h-2 ${statusConfig.color} rounded-full flex-shrink-0 ${
                statusConfig.blink ? 'animate-pulse' : ''
              }`}
              title={statusConfig.text}
            ></div>
          )}
          {/* Version */}
          {!isCollapsed && (
            <span className="text-[10px] sm:text-xs text-gray-400 truncate ml-[18px]">
              Version {VERSION}
            </span>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default Sidebar;
