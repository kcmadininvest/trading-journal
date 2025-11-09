import React, { useState, useEffect, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import UserManagementPage from './pages/UserManagementPage';
import TradesPage from './pages/TradesPage';
import StatisticsPage from './pages/StatisticsPage';
import StrategiesPage from './pages/StrategiesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TradingAccountsPage from './pages/TradingAccountsPage';
import SettingsPage from './pages/SettingsPage';
import ActivateAccountPage from './pages/ActivateAccountPage';
import PositionStrategiesPage from './pages/PositionStrategiesPage';
import { Layout } from './components/layout';
import { authService, User } from './services/auth';
import { useTheme } from './hooks/useTheme';

function App() {
  const { t } = useI18nTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('home');
  const currentPageRef = useRef(currentPage);
  const { theme } = useTheme();
  
  // Maintenir la ref à jour
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    // Vérifier l'authentification au chargement
    const checkAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const user = authService.getCurrentUser();
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Gérer la navigation par hash - séparé pour avoir accès à currentUser à jour
  useEffect(() => {
    if (!currentUser) {
      return; // Ne pas gérer la navigation si l'utilisateur n'est pas connecté
    }

    // Gérer la navigation par hash
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const validPages = ['dashboard', 'calendar', 'trades', 'statistics', 'strategies', 'position-strategies', 'analytics', 'users', 'settings', 'accounts'];
      const page = currentPageRef.current;
      
      // Si on a un hash valide et qu'il est différent de la page actuelle
      if (hash && validPages.includes(hash) && hash !== page) {
        setCurrentPage(hash);
        return;
      }
      
      // Si pas de hash ou hash invalide, et qu'on n'est pas déjà sur dashboard, aller au dashboard
      if ((!hash || !validPages.includes(hash)) && page !== 'dashboard') {
        // Éviter les boucles en vérifiant le hash actuel
        if (window.location.hash !== '#dashboard') {
          window.location.hash = 'dashboard';
          setCurrentPage('dashboard');
        }
      }
    };

    // Écouter les changements de hash
    window.addEventListener('hashchange', handleHashChange);
    
    // Initialiser la page selon le hash actuel au premier rendu
    const currentHash = window.location.hash.replace('#', '').trim();
    const validPages = ['dashboard', 'calendar', 'trades', 'statistics', 'strategies', 'analytics', 'users', 'settings', 'accounts'];
    const page = currentPageRef.current;
    
    if (currentHash && validPages.includes(currentHash)) {
      // Si le hash est valide et différent de la page actuelle, mettre à jour
      if (currentHash !== page) {
        setCurrentPage(currentHash);
      }
    } else if (!currentHash || !validPages.includes(currentHash)) {
      // Si pas de hash valide, aller au dashboard seulement si on n'y est pas déjà
      if (page !== 'dashboard') {
        window.location.hash = 'dashboard';
        setCurrentPage('dashboard');
      }
    }

    // Nettoyage lors du démontage du composant
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [currentUser]); // Ne pas inclure currentPage pour éviter les boucles

  // Gérer les événements de changement d'utilisateur - séparé pour éviter les conflits
  useEffect(() => {
    const handleUserLogin = (event: any) => {
      const user = event.detail?.user;
      if (user) {
        setCurrentUser(user);
      }
    };

    const handleUserLogout = () => {
      setCurrentUser(null);
      setCurrentPage('home');
      window.location.hash = '';
    };

    const handleUserProfileUpdated = (event: any) => {
      const user = event.detail?.user;
      if (user) {
        setCurrentUser(user);
      } else {
        // Si pas d'utilisateur dans l'événement, récupérer depuis authService
        const updatedUser = authService.getCurrentUser();
        if (updatedUser) {
          setCurrentUser(updatedUser);
        }
      }
    };

    // Écouter les événements de changement d'utilisateur
    window.addEventListener('user:login', handleUserLogin);
    window.addEventListener('user:logout', handleUserLogout);
    window.addEventListener('user:profile-updated', handleUserProfileUpdated);

    // Nettoyage lors du démontage du composant
    return () => {
      window.removeEventListener('user:login', handleUserLogin);
      window.removeEventListener('user:logout', handleUserLogout);
      window.removeEventListener('user:profile-updated', handleUserProfileUpdated);
    };
  }, []);

  const renderPage = () => {
    // Vérifier si on est sur la page d'activation
    const pathname = window.location.pathname;
    const activateMatch = pathname.match(/^\/activate-account\/([^/]+)\/?$/);
    if (activateMatch) {
      const token = activateMatch[1];
      return <ActivateAccountPage token={token} />;
    }

    if (!currentUser) {
      return <HomePage />;
    }

        switch (currentPage) {
          case 'trades':
            return <TradesPage />;
          case 'calendar':
            return <CalendarPage />;
          case 'statistics':
            return <StatisticsPage />;
          case 'strategies':
            return <StrategiesPage />;
          case 'position-strategies':
            return <PositionStrategiesPage />;
          case 'analytics':
            return <AnalyticsPage />;
          case 'accounts':
            return <TradingAccountsPage />;
          case 'users':
            return <UserManagementPage />;
          case 'settings':
            return <SettingsPage />;
          case 'dashboard':
          default:
            return <DashboardPage currentUser={currentUser} />;
        }
  };

  const handleNavigate = (page: string) => {
    // Vérifier si on est déjà sur cette page
    if (currentPageRef.current === page) {
      return; // Déjà sur cette page, ne rien faire
    }
    
    // Mettre à jour le hash d'abord, puis la page
    // Cela évitera que handleHashChange ne redirige
    window.location.hash = page;
    setCurrentPage(page);
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setCurrentPage('home');
    window.location.hash = '';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">{t('common:loading')}</p>
        </div>
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{ overflowX: 'hidden' }}>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDark ? '#1f2937' : '#fff',
            color: isDark ? '#f3f4f6' : '#1f2937',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '0.75rem',
            padding: '1rem',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      {currentUser ? (
        <Layout
          currentUser={currentUser}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        >
          {renderPage()}
        </Layout>
      ) : (
        renderPage()
      )}
    </div>
  );
}

export default App;