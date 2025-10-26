import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import FloatingImportButton from '../common/FloatingImportButton';
import GlobalImportModal from '../Import/GlobalImportModal';
import { User } from '../../services/auth';
import appInitializer from '../../services/appInitializer';

interface LayoutProps {
  children: React.ReactNode;
  currentUser?: User | null;
  onLogout?: () => void;
  onShowProfile?: () => void;
  onUserChange?: (user: User | null) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout, onShowProfile, onUserChange }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isGlobalImportOpen, setIsGlobalImportOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Initialiser les optimisations de cache quand l'utilisateur change
  useEffect(() => {
    if (currentUser) {
      // Démarrer l'initialisation en arrière-plan
      appInitializer.initialize().catch(error => {
        console.warn('⚠️ [LAYOUT] Erreur lors de l\'initialisation des optimisations:', error);
      });
    } else {
      // Nettoyer les données quand l'utilisateur se déconnecte
      appInitializer.cleanup();
    }
  }, [currentUser]);
  

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        currentUser={currentUser}
        onLogout={onLogout}
        onShowProfile={onShowProfile}
      />
      
      <div className={`flex-1 flex flex-col ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <Header 
          currentUser={currentUser}
          onUserChange={onUserChange || (() => {})}
          onLogout={onLogout || (() => {})}
        />
        
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
        
        <Footer />
      </div>
      
      {/* Burger menu for mobile */}
      <button 
        className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-gray-600 text-white border-none cursor-pointer shadow-xl z-40 text-2xl hover:bg-gray-700 hover:scale-105 transition-all md:hidden flex items-center justify-center" 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Floating Import Button */}
      <FloatingImportButton 
        onImportClick={() => setIsGlobalImportOpen(true)}
      />

      <GlobalImportModal 
        isOpen={isGlobalImportOpen}
        onClose={() => setIsGlobalImportOpen(false)}
        onImported={() => {
          // Déclencher un rafraîchissement des données si nécessaire
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('trades:updated'));
          }
        }}
      />

    </div>
  );
};

export default Layout;