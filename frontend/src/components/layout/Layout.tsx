import React, { useState, useEffect } from 'react';
import { User } from '../../services/auth';
import userService from '../../services/userService';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  currentUser: User;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

const Layout: React.FC<LayoutProps> = ({
  currentUser,
  currentPage,
  onNavigate,
  onLogout,
  children,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Charger depuis localStorage en premier (pour un chargement immédiat)
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  // Charger les préférences utilisateur au montage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await userService.getPreferences();
        if (preferences.sidebar_collapsed !== undefined) {
          setIsSidebarCollapsed(preferences.sidebar_collapsed);
          // Synchroniser avec localStorage
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(preferences.sidebar_collapsed));
        }
      } catch (error) {
        // Si les préférences n'existent pas encore, utiliser localStorage
        console.error('Erreur lors du chargement des préférences:', error);
      } finally {
        setIsLoadingPreferences(false);
      }
    };
    loadPreferences();

    // Écouter les changements de préférences
    const handlePreferencesUpdate = () => {
      loadPreferences();
    };
    window.addEventListener('preferences:updated', handlePreferencesUpdate);
    return () => {
      window.removeEventListener('preferences:updated', handlePreferencesUpdate);
    };
  }, []);

  // Sauvegarder dans localStorage immédiatement pour un feedback instantané
  useEffect(() => {
    if (!isLoadingPreferences) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
      
      // Sauvegarder dans les préférences utilisateur en arrière-plan
      const saveToServer = async () => {
        try {
          await userService.updatePreferences({ sidebar_collapsed: isSidebarCollapsed });
        } catch (error) {
          console.error('Erreur lors de la sauvegarde de l\'état de la sidebar:', error);
        }
      };
      saveToServer();
    }
  }, [isSidebarCollapsed, isLoadingPreferences]);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={onNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          currentUser={currentUser}
          currentPage={currentPage}
          onLogout={onLogout}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-6 pb-20">
            {children}
          </div>
        </main>

        {/* Footer */}
        <Footer onNavigate={onNavigate} />
      </div>
    </div>
  );
};

export default Layout;
