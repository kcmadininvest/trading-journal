import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User, authService } from '../../services/auth';
import { Tooltip } from '../ui';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { changeLanguage } from '../../i18n/config';
import userService from '../../services/userService';
import { NavigationMenu } from '../navigation';

interface HeaderProps {
  currentUser: User;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, currentPage, onNavigate, onLogout }) => {
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

  const handleLanguageChange = async (lang: string) => {
    // Changer la langue dans i18n
    changeLanguage(lang);
    setIsLanguageDropdownOpen(false);
    
    // Sauvegarder dans le backend si l'utilisateur est authentifié
    if (authService.isAuthenticated()) {
      try {
        await userService.updatePreferences({ language: lang as any });
      } catch {
        // Ne pas logger en production
      }
    }
  };
  
  const pageTitle = useMemo(() => {
    const titles: { [key: string]: string } = {
      dashboard: t('navigation:dashboard'),
      calendar: t('navigation:calendar'),
      'daily-journal': t('navigation:dailyJournal', { defaultValue: 'Journal' }),
      trades: t('navigation:trades'),
      statistics: t('navigation:statistics'),
      strategies: t('navigation:strategies'),
      'position-strategies': t('navigation:positionStrategies'),
      analytics: t('navigation:analytics'),
      accounts: t('navigation:accounts'),
      transactions: t('navigation:transactions', { defaultValue: 'Transactions' }),
      goals: t('navigation:goals'),
      users: t('navigation:users'),
      settings: t('navigation:settings'),
    };
    return titles[currentPage] || t('navigation:header.appName');
  }, [currentPage, t]);

  const handleLogout = () => {
    authService.logout();
    onLogout();
  };

  return (
    <header className="bg-blue-950 shadow-sm border-b border-gray-700 h-16 sm:h-20 flex items-center fixed top-0 left-0 right-0 z-30">
      <div className="flex items-center justify-between px-3 sm:px-6 w-full h-full gap-2 sm:gap-4">
        {/* Left: Logo + App Title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Logo/Brand - clickable to dashboard */}
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
            title="Retour au tableau de bord"
          >
            <img 
              src="/android-chrome-512x512.png" 
              alt="K&C Trading Journal" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-base lg:text-lg font-semibold text-white whitespace-nowrap hidden sm:inline">K&C Trading Journal</span>
          </button>
          
          {/* Separator */}
          <div className="hidden 2xl:block h-8 w-px bg-gray-600"></div>
        </div>

        {/* Center: Navigation + Page Title */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Navigation Menu (Mobile hamburger + Desktop nav) */}
          <NavigationMenu
            currentUser={currentUser}
            currentPage={currentPage}
            onNavigate={onNavigate}
          />
          
          {/* Page title - visible below 2xl (where nav is hidden), hidden on 2xl+ */}
          <div className="flex 2xl:hidden items-center justify-center flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-white truncate">
              {pageTitle}
            </h1>
          </div>
          {/* Page title - centered on 2xl+ where full nav is shown */}
          <div className="hidden 2xl:flex items-center justify-center flex-1 min-w-0">
            <h1 className="text-base lg:text-lg font-semibold text-white truncate">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Right: User info and actions */}
        <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
          {/* User info - hidden on mobile, shown on sm and up */}
          <div className="text-right hidden 2xl:block">
            <div className="flex items-center justify-end space-x-2">
              <p className="text-sm font-medium text-white truncate max-w-[120px]">
                {currentUser.first_name && currentUser.last_name 
                  ? `${currentUser.first_name} ${currentUser.last_name}` 
                  : currentUser.email}
              </p>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                currentUser.is_admin 
                  ? 'bg-red-500/20 text-red-300' 
                  : 'bg-blue-500/20 text-blue-300'
              }`}>
                {currentUser.is_admin ? t('navigation:admin') : t('navigation:user')}
              </span>
            </div>
          </div>

          {/* Icons group */}
          <div className="flex items-center space-x-0.5 sm:space-x-1">
            {/* Language selector */}
            <div className="relative" ref={languageDropdownRef}>
              <Tooltip content={t('settings:language', { defaultValue: 'Language' })} position="left">
                <button
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-blue-950"
                  aria-label={t('settings:language', { defaultValue: 'Language' })}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
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
                className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-blue-950 focus-visible:ring-2"
                aria-label={theme === 'dark' ? t('settings:themeLight') : t('settings:themeDark')}
              >
                {theme === 'dark' ? (
                  // Sun icon for light mode
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  // Moon icon for dark mode
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </Tooltip>
            
            {/* Logout button */}
            <Tooltip content={t('navigation:header.logout')} position="left">
              <button
                onClick={handleLogout}
                className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-blue-950"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
