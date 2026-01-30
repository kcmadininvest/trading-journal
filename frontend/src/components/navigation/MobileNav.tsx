import React, { useState } from 'react';
import { User } from '../../services/auth';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { NavItemConfig } from './NavGroup';

interface MobileNavProps {
  currentUser: User;
  currentPage: string;
  onNavigate: (page: string) => void;
  menuItems: {
    trading: NavItemConfig[];
    management: NavItemConfig[];
    strategies: NavItemConfig[];
    system: NavItemConfig[];
  };
}

const MobileNav: React.FC<MobileNavProps> = ({ currentUser, currentPage, onNavigate, menuItems }) => {
  const { t } = useI18nTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsOpen(false);
    setExpandedGroup(null);
  };

  const toggleGroup = (group: string) => {
    setExpandedGroup(expandedGroup === group ? null : group);
  };

  const groups = [
    { id: 'trading', label: t('navigation:groups.trading', { defaultValue: 'Trading' }), items: menuItems.trading, icon: '📊' },
    { id: 'management', label: t('navigation:groups.management', { defaultValue: 'Gestion' }), items: menuItems.management, icon: '📁' },
    { id: 'strategies', label: t('navigation:groups.strategies', { defaultValue: 'Stratégies' }), items: menuItems.strategies, icon: '⚡' },
    { id: 'system', label: t('navigation:groups.system', { defaultValue: 'Système' }), items: menuItems.system, icon: '⚙️' },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden inline-flex items-center justify-center w-10 h-10 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-all duration-200"
        aria-label={t('navigation:menu', { defaultValue: 'Menu' })}
        aria-expanded={isOpen}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-gray-900 border-r border-gray-700 z-50 transform transition-transform duration-300 ease-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">K&C Trading Journal</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label={t('common:close', { defaultValue: 'Fermer' })}
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
              {currentUser.first_name?.[0] || currentUser.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {currentUser.first_name && currentUser.last_name 
                  ? `${currentUser.first_name} ${currentUser.last_name}` 
                  : currentUser.email}
              </p>
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                currentUser.is_admin 
                  ? 'bg-red-500/20 text-red-300' 
                  : 'bg-blue-500/20 text-blue-300'
              }`}>
                {currentUser.is_admin ? t('navigation:admin') : t('navigation:user')}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {groups.map((group) => {
            const visibleItems = group.items.filter(item => item.visible);
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedGroup === group.id;
            const hasActiveItem = visibleItems.some(item => item.id === currentPage);

            return (
              <div key={group.id} className="mb-2">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    hasActiveItem
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{group.icon}</span>
                    <span>{group.label}</span>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="mt-1 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {visibleItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          currentPage === item.id
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:text-white hover:bg-gray-700'
                        }`}
                      >
                        <span className="flex-shrink-0 w-4 h-4">
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default MobileNav;
