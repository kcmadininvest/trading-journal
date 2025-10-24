import React, { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import './styles/devtools.css';
import { queryClient } from './lib/queryClient';
import { PageSuspense } from './components/SuspenseBoundary';
import Layout from './components/Layout/Layout';
import SidebarProfileModal from './components/Layout/SidebarProfileModal';
import SessionWarningModal from './components/auth/SessionWarningModal';
import { LazyTradesPage, LazyStrategyPage, LazyStatisticsPage, LazyAnalyticsPage, LazyTradingAccountsPage, LazySettingsPage, LazyArchivesPage, LazyPositionStrategiesPage, LazyHomePage } from './components/LazyPages';
import { authService, User } from './services/auth';
import sessionManager, { SessionWarning } from './services/sessionManager';

function App() {
  const [currentPage, setCurrentPage] = useState('trades');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebarProfile, setShowSidebarProfile] = useState(false);
  const [sessionWarning, setSessionWarning] = useState<SessionWarning | null>(null);

  useEffect(() => {
    // Vérifier l'authentification au chargement
    const checkAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const user = authService.getCurrentUser();
          setCurrentUser(user);
          
          // Initialiser le gestionnaire de session si l'utilisateur est connecté
          sessionManager.initialize(
            (warning: SessionWarning) => {
              setSessionWarning(warning);
            },
            () => {
              // Déconnexion automatique
              setCurrentUser(null);
              setSessionWarning(null);
              // Rediriger vers la page d'accueil
              window.location.hash = '#app';
            }
          );
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Gérer la navigation par hash
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'statistics') {
        setCurrentPage('statistics');
      } else if (hash === 'analytics') {
        setCurrentPage('analytics');
      } else if (hash === 'strategy') {
        setCurrentPage('strategy');
      } else if (hash === 'position-strategies') {
        setCurrentPage('position-strategies');
      } else if (hash === 'archives') {
        setCurrentPage('archives');
      } else if (hash === 'trading-accounts') {
        setCurrentPage('trading-accounts');
      } else if (hash === 'settings' || hash.startsWith('settings-')) {
        setCurrentPage('settings');
      } else {
        setCurrentPage('trades');
      }
    };

    // Écouter les changements de hash
    window.addEventListener('hashchange', handleHashChange);
    
    // Initialiser la page selon le hash actuel
    handleHashChange();

    // Nettoyage lors du démontage du composant
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      sessionManager.stop();
    };
  }, []);


  // Handlers pour la gestion de session
  const handleSessionWarningExtend = () => {
    setSessionWarning(null);
  };

  const handleSessionWarningDismiss = () => {
    setSessionWarning(null);
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    // Mettre à jour aussi le service d'authentification
    authService.updateCurrentUser(updatedUser);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'statistics':
        return <LazyStatisticsPage />;
      case 'analytics':
        return <LazyAnalyticsPage />;
      case 'strategy':
        return <LazyStrategyPage />;
      case 'position-strategies':
        return <LazyPositionStrategiesPage />;
      case 'archives':
        return <LazyArchivesPage />;
      case 'trading-accounts':
        return <LazyTradingAccountsPage />;
      case 'settings':
        return <LazySettingsPage currentUser={currentUser!} onUserUpdate={handleUserUpdate} />;
      default:
        return <LazyTradesPage />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher la page d'accueil
  if (!currentUser) {
    return (
      <div className="min-h-screen" style={{ overflowX: 'hidden' }}>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#1f2937',
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
        <LazyHomePage />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50" style={{ overflowX: 'hidden' }}>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#1f2937',
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
      <Layout 
        currentUser={currentUser} 
        onLogout={() => setCurrentUser(null)}
        onShowProfile={() => setShowSidebarProfile(true)}
        onUserChange={setCurrentUser}
      >
        <PageSuspense>
          {renderPage()}
        </PageSuspense>
      </Layout>

      {currentUser && (
        <SidebarProfileModal
          user={currentUser}
          isOpen={showSidebarProfile}
          onClose={() => setShowSidebarProfile(false)}
          onPasswordChanged={() => {
            // Optionnel : rafraîchir les données utilisateur
            const user = authService.getCurrentUser();
            setCurrentUser(user);
          }}
        />
      )}

      {/* Modal d'avertissement de session */}
      {sessionWarning && (
        <SessionWarningModal
          warning={sessionWarning}
          onExtend={handleSessionWarningExtend}
          onDismiss={handleSessionWarningDismiss}
        />
      )}
      </div>
      
      {/* React Query DevTools en développement */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          buttonPosition="bottom-left"
          position="bottom"
        />
      )}
    </QueryClientProvider>
  );
}

export default App;
