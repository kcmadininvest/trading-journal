import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout/Layout';
import SidebarProfileModal from './components/Layout/SidebarProfileModal';
import SessionWarningModal from './components/auth/SessionWarningModal';
import HomePage from './pages/HomePage';
import TradesPage from './pages/TradesPage';
import StatisticsPage from './pages/StatisticsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import StrategyPage from './pages/StrategyPage';
import SettingsPage from './pages/SettingsPage';
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

    // Nettoyage lors du démontage du composant
    return () => {
      sessionManager.stop();
    };
  }, []);

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash;
      if (hash === '#statistics') {
        setCurrentPage('statistics');
      } else if (hash === '#calendar') {
        setCurrentPage('calendar');
      } else if (hash === '#analytics') {
        setCurrentPage('analytics');
      } else if (hash === '#strategy') {
        setCurrentPage('strategy');
      } else if (hash === '#settings' || hash.startsWith('#settings-')) {
        setCurrentPage('settings');
      } else {
        setCurrentPage('trades');
      }
    }

    // Set initial page based on current hash
    onHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
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
        return <StatisticsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'strategy':
        return <StrategyPage />;
      case 'settings':
        return <SettingsPage currentUser={currentUser!} onUserUpdate={handleUserUpdate} />;
      default:
        return <TradesPage />;
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
        <HomePage />
      </div>
    );
  }

  return (
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
        {renderPage()}
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
  );
}

export default App;
