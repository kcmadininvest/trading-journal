import React, { useEffect, useState } from 'react';
import { User } from '../../services/auth';
import UserProfileSection from './UserProfileSection';
// import LogoutButton from './LogoutButton';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  onShowProfile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  collapsed = false, 
  onToggleCollapse,
  currentUser,
  onLogout,
  onShowProfile
}) => {
  const [hash, setHash] = useState<string>(typeof window !== 'undefined' ? window.location.hash : '')

  useEffect(() => {
    function onHashChange() {
      setHash(window.location.hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const isDashboard = !hash || hash === '#app'
  const isStrategy = hash === '#strategy'
  const isPositionStrategies = hash === '#position-strategies'
  const isArchives = hash === '#archives'
  const isTrades = hash === '#trades-table'
  const isStatistics = hash === '#statistics'
  const isAnalytics = hash === '#analytics'
  const isTradingAccounts = hash === '#trading-accounts'
  return (
    <>
      {/* Overlay pour mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" 
          onClick={onClose}
        ></div>
      )}
      
      <aside className={`fixed left-0 top-0 h-screen ${collapsed ? 'w-16' : 'w-64'} bg-gray-900 text-white flex flex-col transition-all duration-300 z-40 overflow-y-auto overflow-x-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`} style={{ boxSizing: 'border-box', maxWidth: collapsed ? '64px' : '256px', width: collapsed ? '64px' : '256px', left: 0, right: 'auto' }}>
        <div className="p-4 flex justify-between items-center border-b border-gray-700 max-w-full h-16" style={{ boxSizing: 'border-box' }}>
          <h2 className={`text-xl font-bold ${collapsed ? 'hidden md:hidden' : ''}`}>Menu</h2>
          <button 
            className={`hidden md:flex items-center justify-center w-8 h-8 rounded bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors ${collapsed ? 'mx-auto' : ''}`}
            onClick={onToggleCollapse}
            title={collapsed ? 'Étendre' : 'Réduire'}
          >
            {collapsed ? '›' : '‹'}
          </button>
          <button 
            className="bg-transparent border-none text-white text-2xl cursor-pointer md:hidden"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <nav className="flex-1 py-4 min-w-0 max-w-full" style={{ boxSizing: 'border-box' }}>
          <a href="#app" className={`flex items-center gap-3 px-4 py-3 no-underline transition-all min-w-0 ${isDashboard ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Dashboard</span>
          </a>
          
          <a href="#strategy" className={`flex items-center gap-3 px-4 py-3 no-underline transition-all min-w-0 ${isStrategy ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Stratégie</span>
          </a>
          
          <a href="#position-strategies" className={`flex items-center gap-3 px-4 py-3 no-underline transition-all min-w-0 ${isPositionStrategies ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Mes Stratégies</span>
          </a>
          
          <a href="#archives" className={`flex items-center gap-3 px-4 py-3 no-underline transition-all min-w-0 ${isArchives ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 8v13H3V8M1 3h22l-1 5H2L1 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Archives</span>
          </a>
          
          <a href="#statistics" className={`flex items-center gap-3 px-4 py-3 no-underline transition-all min-w-0 ${isStatistics ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h3v8H5v-8Zm6-6h3v14h-3V6Zm6 4h3v10h-3V10Z" fill="currentColor"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Statistiques</span>
          </a>
          
          <a href="#analytics" className={`flex items-center gap-3 px-4 py-3 no-underline transition-all min-w-0 ${isAnalytics ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Analyses</span>
          </a>
          
          
          <a href="#trades-table" className={`flex items-center gap-3 px-4 py-3 no-underline transition-all min-w-0 ${isTrades ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 18l5-6 3 3 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Mes Trades</span>
          </a>
          
          <a href="#trading-accounts" className={`flex items-center gap-3 px-4 py-3 no-underline transition-all min-w-0 ${isTradingAccounts ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Comptes de Trading</span>
          </a>
          
          
          {currentUser?.is_admin && (
            <a href="#settings" className="flex items-center gap-3 px-4 py-3 text-gray-300 no-underline transition-all hover:bg-gray-800 hover:text-white min-w-0">
              <span aria-hidden="true" className="flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className={`${collapsed ? 'hidden' : ''} truncate`}>Paramètres</span>
            </a>
          )}
          
          <a href="#help" className="flex items-center gap-3 px-4 py-3 text-gray-300 no-underline transition-all hover:bg-gray-800 hover:text-white min-w-0">
            <span aria-hidden="true" className="flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.09 9a3 3 0 115.82 1c0 2-3 2-3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="17" r="1" fill="currentColor"/>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </span>
            <span className={`${collapsed ? 'hidden' : ''} truncate`}>Aide</span>
          </a>
        </nav>
        
        <UserProfileSection 
          user={currentUser || null}
          collapsed={collapsed}
          onLogout={onLogout || (() => {})}
          onShowProfile={onShowProfile || (() => {})}
        />
        
      </aside>
    </>
  );
};

export default Sidebar;