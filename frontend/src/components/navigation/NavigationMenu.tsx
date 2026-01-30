import React from 'react';
import { User } from '../../services/auth';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import NavGroup, { NavItemConfig } from './NavGroup';
import NavItem from './NavItem';
import MobileNav from './MobileNav';

interface NavigationMenuProps {
  currentUser: User;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({ currentUser, currentPage, onNavigate }) => {
  const { t } = useI18nTranslation();

  const tradingItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      label: t('navigation:dashboard'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/>
        </svg>
      ),
      visible: true,
    },
    {
      id: 'trades',
      label: t('navigation:trades'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 18l5-6 3 3 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      visible: true,
    },
    {
      id: 'analytics',
      label: t('navigation:analytics'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'statistics',
      label: t('navigation:statistics'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      visible: true,
    },
  ];

  const managementItems: NavItemConfig[] = [
    {
      id: 'calendar',
      label: t('navigation:calendar'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'daily-journal',
      label: t('navigation:dailyJournal', { defaultValue: 'Journal' }),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h10a2 2 0 012 2v11a1 1 0 01-1 1H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h-1a2 2 0 00-2 2v11a1 1 0 001 1h1" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 10h5M11 14h5M11 18h3" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'accounts',
      label: t('navigation:accounts'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'transactions',
      label: t('navigation:transactions', { defaultValue: 'Transactions' }),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'goals',
      label: t('navigation:goals', { defaultValue: 'Objectifs' }),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      visible: true,
    },
  ];

  const strategiesItems: NavItemConfig[] = [
    {
      id: 'strategies',
      label: t('navigation:strategies'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      visible: true,
    },
    {
      id: 'position-strategies',
      label: t('navigation:positionStrategies', { defaultValue: 'Stratégies de Position' }),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      visible: true,
    },
  ];

  const systemItems: NavItemConfig[] = [
    {
      id: 'settings',
      label: t('navigation:settings'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      visible: true,
    },
    {
      id: 'users',
      label: t('navigation:users'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      visible: currentUser.is_admin,
    },
  ];

  const menuItems = {
    trading: tradingItems,
    management: managementItems,
    strategies: strategiesItems,
    system: systemItems,
  };

  return (
    <>
      {/* Mobile Navigation */}
      <MobileNav
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={onNavigate}
        menuItems={menuItems}
      />

      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center gap-1">
        {/* Dashboard - direct link */}
        <NavItem
          id="dashboard"
          label={t('navigation:dashboard')}
          icon={tradingItems[0].icon}
          isActive={currentPage === 'dashboard'}
          onClick={onNavigate}
        />

        {/* Trading Group */}
        <NavGroup
          label={t('navigation:groups.trading', { defaultValue: 'Trading' })}
          items={tradingItems.slice(1)}
          currentPage={currentPage}
          onNavigate={onNavigate}
          icon={
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 18l5-6 3 3 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        />

        {/* Management Group */}
        <NavGroup
          label={t('navigation:groups.management', { defaultValue: 'Gestion' })}
          items={managementItems}
          currentPage={currentPage}
          onNavigate={onNavigate}
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />

        {/* Strategies Group */}
        <NavGroup
          label={t('navigation:groups.strategies', { defaultValue: 'Stratégies' })}
          items={strategiesItems}
          currentPage={currentPage}
          onNavigate={onNavigate}
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />

        {/* Settings - direct link */}
        <NavItem
          id="settings"
          label={t('navigation:settings')}
          icon={systemItems[0].icon}
          isActive={currentPage === 'settings'}
          onClick={onNavigate}
        />

        {/* Users - admin only, direct link */}
        {currentUser.is_admin && (
          <NavItem
            id="users"
            label={t('navigation:users')}
            icon={systemItems[1].icon}
            isActive={currentPage === 'users'}
            onClick={onNavigate}
          />
        )}
      </nav>
    </>
  );
};

export default NavigationMenu;
