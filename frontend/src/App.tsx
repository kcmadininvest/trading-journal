import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast/headless';
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
import TransactionsPage from './pages/TransactionsPage';
import SettingsPage from './pages/SettingsPage';
import ActivateAccountPage from './pages/ActivateAccountPage';
import PositionStrategiesPage from './pages/PositionStrategiesPage';
import GoalsPage from './pages/GoalsPage';
import LegalNoticePage from './pages/LegalNoticePage';
import AboutPage from './pages/AboutPage';
import FeaturesPage from './pages/FeaturesPage';
import DailyJournalPage from './pages/DailyJournalPage';
import OrganizationSchema from './components/SEO/OrganizationSchema';
import { Layout } from './components/layout';
import { authService, User } from './services/auth';
import { useTheme } from './hooks/useTheme';
import { goalsService, TradingGoal } from './services/goals';
import { tradingAccountsService } from './services/tradingAccounts';
import ToastViewport from './components/ui/ToastViewport';

function App() {
  const { t } = useI18nTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('home');
  const currentPageRef = useRef(currentPage);
  const [showAccountCreationPrompt, setShowAccountCreationPrompt] = useState(false);
  useTheme();
  const notifiedGoalsRef = useRef<Set<number>>(new Set()); // Objectifs pour lesquels on a déjà notifié
  
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

  // Déclencher l'onboarding "comptes de trading" pour les nouveaux utilisateurs
  useEffect(() => {
    if (!currentUser) {
      setShowAccountCreationPrompt(false);
      return;
    }

    let isMounted = true;
    const storageKey = `account_onboarding_prompt_shown_${currentUser.id}`;
    const alreadyShown = localStorage.getItem(storageKey) === 'true';

    const ensureAccountSetup = async () => {
      try {
        const accounts = await tradingAccountsService.list({ include_archived: true, include_inactive: true });
        if (!isMounted) return;

        const hasAccounts = Array.isArray(accounts) && accounts.length > 0;

        if (!hasAccounts && !alreadyShown) {
          setShowAccountCreationPrompt(true);
          localStorage.setItem(storageKey, 'true');
          if (currentPageRef.current !== 'accounts') {
            window.location.hash = 'accounts';
            setCurrentPage('accounts');
          }
        } else if (hasAccounts) {
          localStorage.setItem(storageKey, 'true');
          setShowAccountCreationPrompt(false);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des comptes de trading:', error);
      }
    };

    ensureAccountSetup();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Vérification globale des objectifs récemment atteints (même si pas sur la page Goals)
  useEffect(() => {
    if (!currentUser) return;

    const checkRecentAchievements = async () => {
      try {
        // Charger uniquement les objectifs atteints récemment
        const achievedGoals = await goalsService.list({ status: 'achieved' });
        const now = new Date();
        
        achievedGoals.forEach((goal: TradingGoal) => {
          if (notifiedGoalsRef.current.has(goal.id)) return; // Déjà notifié
          
          // Vérifier si l'objectif a été atteint récemment (dans les 5 dernières minutes)
          let recentlyAchieved = false;
          
          if (goal.last_achieved_alert_sent) {
            const alertSentDate = new Date(goal.last_achieved_alert_sent);
            const minutesSinceAlert = (now.getTime() - alertSentDate.getTime()) / (1000 * 60);
            recentlyAchieved = minutesSinceAlert <= 5;
          } else if (goal.updated_at) {
            const updatedDate = new Date(goal.updated_at);
            const minutesSinceUpdate = (now.getTime() - updatedDate.getTime()) / (1000 * 60);
            recentlyAchieved = minutesSinceUpdate <= 5 && goal.status === 'achieved';
          }
          
          if (recentlyAchieved) {
            const goalTypeLabel = t(`goals:goalTypes.${goal.goal_type}`, { defaultValue: goal.goal_type });
            toast.success(
              t('goals:goalAchievedNotification', { 
                defaultValue: `🎉 Objectif atteint : ${goalTypeLabel}`,
                goalType: goalTypeLabel
              }),
              { duration: 5000, icon: '🎉' }
            );
            notifiedGoalsRef.current.add(goal.id);
          }
        });
      } catch (err) {
        // Ignorer les erreurs silencieusement
        console.error('Erreur lors de la vérification des objectifs:', err);
      }
    };

    // Vérifier immédiatement au chargement
    checkRecentAchievements();

    // Vérifier périodiquement (toutes les 30 secondes)
    const interval = setInterval(checkRecentAchievements, 30000);

    return () => clearInterval(interval);
  }, [currentUser, t]);

  // Gérer la navigation par hash - séparé pour avoir accès à currentUser à jour
  useEffect(() => {
    if (!currentUser) {
      return; // Ne pas gérer la navigation si l'utilisateur n'est pas connecté
    }

    // Gérer la navigation par hash
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const validPages = ['dashboard', 'calendar', 'daily-journal', 'trades', 'statistics', 'strategies', 'position-strategies', 'analytics', 'users', 'settings', 'accounts', 'transactions', 'goals', 'legal-notice'];
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
    const validPages = ['dashboard', 'calendar', 'daily-journal', 'trades', 'statistics', 'strategies', 'position-strategies', 'analytics', 'users', 'settings', 'accounts', 'transactions', 'goals', 'legal-notice'];
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

    // Pages publiques accessibles via pathname (SEO) - Support multilingue
    const aboutPaths = ['/a-propos', '/about', '/acerca-de', '/uber-uns'];
    const featuresPaths = ['/fonctionnalites', '/features', '/funcionalidades', '/funktionen'];
    
    if (aboutPaths.includes(pathname)) {
      return <AboutPage />;
    }
    if (featuresPaths.includes(pathname)) {
      return <FeaturesPage />;
    }

    // La page des mentions légales est accessible sans authentification
    if (currentPage === 'legal-notice') {
      return <LegalNoticePage />;
    }

    if (!currentUser) {
      return <HomePage />;
    }

        switch (currentPage) {
          case 'trades':
            return <TradesPage />;
          case 'calendar':
            return <CalendarPage />;
          case 'daily-journal':
            return <DailyJournalPage />;
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
          case 'transactions':
            return <TransactionsPage />;
          case 'goals':
            return <GoalsPage />;
          case 'users':
            return <UserManagementPage />;
          case 'settings':
            return <SettingsPage />;
          case 'legal-notice':
            return <LegalNoticePage />;
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* Charger le schéma JSON-LD pour le SEO de manière compatible CSP */}
      <OrganizationSchema />
      
      <ToastViewport />
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

      {showAccountCreationPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
              <svg className="h-8 w-8 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 11c0-2.828 2.686-5 6-5s6 2.172 6 5-2.686 5-6 5a7.6 7.6 0 01-2-.258L12 18v-4m-6 3a6 6 0 01-6-6c0-2.828 2.686-5 6-5s6 2.172 6 5-2.686 5-6 5a7.6 7.6 0 01-2-.258L0 18v-4" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('accounts:onboarding.title', { defaultValue: 'Créez votre premier compte de trading' })}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('accounts:onboarding.description', {
                defaultValue: 'Avant de commencer à enregistrer vos trades, créez un compte de trading. Nous vous avons redirigé vers l’onglet « Comptes de trading » pour vous guider.',
              })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  window.location.hash = 'accounts';
                  setCurrentPage('accounts');
                  setShowAccountCreationPrompt(false);
                }}
                className="flex-1 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 px-4 py-2.5 font-medium hover:bg-blue-100 dark:border-blue-700/50 dark:bg-blue-900/30 dark:text-blue-200 transition"
              >
                {t('accounts:onboarding.openTab', { defaultValue: 'Aller aux comptes' })}
              </button>
              <button
                onClick={() => setShowAccountCreationPrompt(false)}
                className="flex-1 rounded-xl bg-gray-900 text-white px-4 py-2.5 font-medium hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 transition"
              >
                {t('common:gotIt', { defaultValue: 'Compris' })}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t('accounts:onboarding.helper', { defaultValue: 'Cliquez sur « Nouveau compte » pour lancer la création.' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;