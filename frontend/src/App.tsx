import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { toast } from 'react-hot-toast/headless';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import OrganizationSchema from './components/SEO/OrganizationSchema';
import { Layout } from './components/layout';
import { authService, User } from './services/auth';
import { billingService, SubscriptionStatus } from './services/billing';
import userService, { AppSettings } from './services/userService';
import { useTheme } from './hooks/useTheme';
import { goalsService, TradingGoal } from './services/goals';
import ToastViewport from './components/ui/ToastViewport';
import { ComplianceRefreshProvider } from './contexts/ComplianceRefreshContext';
import { ImageLightboxProvider } from './contexts/ImageLightboxContext';
import { useBootstrap } from './hooks/useBootstrap';
import { useTradingAccounts } from './hooks/useTradingAccounts';

const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const TradesPage = lazy(() => import('./pages/TradesPage'));
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const BehaviorPage = lazy(() => import('./pages/BehaviorPage'));
const TradingAccountsPage = lazy(() => import('./pages/TradingAccountsPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const TradingActivityPage = lazy(() => import('./pages/TradingActivityPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ActivateAccountPage = lazy(() => import('./pages/ActivateAccountPage'));
const PositionStrategiesPage = lazy(() => import('./pages/PositionStrategiesPage'));
const StrategyChecklistPopup = lazy(() => import('./pages/StrategyChecklistPopup'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const LegalNoticePage = lazy(() => import('./pages/LegalNoticePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const DailyJournalPage = lazy(() => import('./pages/DailyJournalPage'));
const SessionReplayPage = lazy(() => import('./pages/SessionReplayPage'));
const CalculatorPage = lazy(() => import('./pages/CalculatorPage'));
const CalculatorPopup = lazy(() => import('./pages/CalculatorPopup'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const SubscriptionRequiredPage = lazy(() => import('./pages/SubscriptionRequiredPage'));
const StrategiesPage = lazy(() => import('./pages/StrategiesPage'));

const PageLoader = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-sky-500 dark:border-gray-700 dark:border-t-sky-400" />
  </div>
);

const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);
const PREMIUM_LOCKED_PAGES = new Set([
  'statistics',
  'analytics',
  'behavior',
  'goals',
  'calculator',
  'strategies',
  'position-strategies',
  'trading-activity',
  'session-replay',
]);
const ALWAYS_ACCESSIBLE_PAGES = new Set([
  'accounts',
  'dashboard',
  'calendar',
  'daily-journal',
  'trades',
  'transactions',
  'settings',
]);

const VALID_HASH_PAGES = [
  'dashboard',
  'calendar',
  'daily-journal',
  'session-replay',
  'trades',
  'statistics',
  'behavior',
  'strategies',
  'position-strategies',
  'analytics',
  'users',
  'settings',
  'accounts',
  'transactions',
  'trading-activity',
  'goals',
  'calculator',
  'legal-notice',
  'billing',
  'billing-success',
  'billing-cancel',
  'subscription-required',
] as const;

function getPageFromHash(): string {
  const hashRaw = window.location.hash.replace('#', '').trim();
  const hash = hashRaw.split('?')[0];
  if (hash && (VALID_HASH_PAGES as readonly string[]).includes(hash)) {
    return hash;
  }
  return authService.isAuthenticated() ? 'dashboard' : 'home';
}

function App() {
  const { t } = useI18nTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(getPageFromHash);
  const currentPageRef = useRef(currentPage);
  const [showAccountCreationPrompt, setShowAccountCreationPrompt] = useState(false);
  const [billingStatus, setBillingStatus] = useState<SubscriptionStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  useTheme();
  const notifiedGoalsRef = useRef<Set<number>>(new Set());
  const isAuthenticated = !!currentUser || authService.isAuthenticated();
  const { data: bootstrap } = useBootstrap(isAuthenticated);
  const { data: allAccounts } = useTradingAccounts({
    includeArchived: true,
    enabled: !!currentUser,
  });
  
  // Maintenir la ref à jour
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const loadAppSettings = React.useCallback(async () => {
    try {
      const data = await userService.getAppSettings();
      setAppSettings(data);
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres application:', error);
      setAppSettings({ premium_restrictions_enabled: false });
    }
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      try {
        if (authService.isAuthenticated()) {
          setCurrentUser(authService.getCurrentUser());
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (bootstrap?.app_settings) {
      setAppSettings(bootstrap.app_settings);
    }
  }, [bootstrap]);

  useEffect(() => {
    if (!currentUser || bootstrap?.app_settings) return;
    void loadAppSettings();
  }, [currentUser, bootstrap, loadAppSettings]);

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
        const hasAccounts =
          bootstrap?.has_accounts ??
          (Array.isArray(allAccounts) && allAccounts.length > 0);

        if (!isMounted) return;

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
  }, [currentUser, bootstrap, allAccounts]);

  const premiumRestrictionsEnabled = appSettings?.premium_restrictions_enabled === true;
  const premiumRestrictionsSetting = appSettings?.premium_restrictions_enabled ?? true;

  const refreshBillingStatus = React.useCallback(async () => {
    if (!currentUser) {
      setBillingStatus(null);
      return;
    }
    setBillingLoading(true);
    setBillingError(null);
    try {
      const data = await billingService.getSubscriptionStatus();
      setBillingStatus(data);
    } catch (error: any) {
      setBillingError(error?.message || 'billing_error');
    } finally {
      setBillingLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!premiumRestrictionsEnabled) {
      setBillingStatus(null);
      setBillingError(null);
      setBillingLoading(false);
      return;
    }
    if (!currentUser) return;

    const billingPages = new Set(['billing', 'billing-success', 'billing-cancel', 'settings']);
    if (billingPages.has(currentPageRef.current)) {
      refreshBillingStatus();
      return;
    }

    const timer = window.setTimeout(() => {
      refreshBillingStatus();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [refreshBillingStatus, premiumRestrictionsEnabled, currentUser]);

  useEffect(() => {
    if (currentUser) {
      return;
    }
    setAppSettings(null);
  }, [currentUser, loadAppSettings]);

  useEffect(() => {
    const handleAppSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ appSettings?: AppSettings }>).detail;
      if (detail?.appSettings) {
        setAppSettings(detail.appSettings);
      } else {
        void loadAppSettings();
      }
    };
    window.addEventListener('app:settings-updated', handleAppSettingsUpdated);
    return () => window.removeEventListener('app:settings-updated', handleAppSettingsUpdated);
  }, [loadAppSettings]);

  const hasPremiumAccess = React.useMemo(() => {
    if (!currentUser) return false;
    if (!premiumRestrictionsEnabled) return true;
    if (currentUser.is_admin) return true;
    return billingStatus?.access_state === 'trialing' || billingStatus?.access_state === 'active';
  }, [currentUser, billingStatus, premiumRestrictionsEnabled]);

  const lockedPremiumPages = React.useMemo(() => {
    if (!currentUser || !premiumRestrictionsEnabled || hasPremiumAccess) return new Set<string>();
    return new Set(
      Array.from(PREMIUM_LOCKED_PAGES).filter((page) => !ALWAYS_ACCESSIBLE_PAGES.has(page))
    );
  }, [currentUser, hasPremiumAccess, premiumRestrictionsEnabled]);

  const billingStatusLabel = React.useMemo(() => {
    if (!premiumRestrictionsEnabled || !currentUser || !billingStatus || billingStatus.access_state === 'admin_bypass') {
      return null;
    }
    if (billingStatus.access_state === 'trialing') {
      return t('billing:header.trialBadge', { count: billingStatus.trial_days_left });
    }
    if (billingStatus.access_state === 'active') {
      return t('billing:header.activeBadge');
    }
    return t('billing:header.inactiveBadge');
  }, [currentUser, billingStatus, premiumRestrictionsEnabled, t]);

  // Vérification globale des objectifs récemment atteints (même si pas sur la page Goals)
  useEffect(() => {
    if (!currentUser || currentUser.is_admin) return;

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

    let interval: number | undefined;
    const startTimer = window.setTimeout(() => {
      void checkRecentAchievements();
      interval = window.setInterval(checkRecentAchievements, 30000);
    }, 1500);

    return () => {
      if (startTimer !== undefined) {
        window.clearTimeout(startTimer);
      }
      if (interval) window.clearInterval(interval);
    };
  }, [currentUser, t]);

  // Gérer la navigation par hash - séparé pour avoir accès à currentUser à jour
  useEffect(() => {
    if (!currentUser) {
      return; // Ne pas gérer la navigation si l'utilisateur n'est pas connecté
    }

    // Gérer la navigation par hash
    const handleHashChange = () => {
      const hashRaw = window.location.hash.replace('#', '').trim();
      const hash = hashRaw.split('?')[0];
      const page = currentPageRef.current;
      
      // Si on a un hash valide et qu'il est différent de la page actuelle
      if (hash && (VALID_HASH_PAGES as readonly string[]).includes(hash) && hash !== page) {
        if (lockedPremiumPages.has(hash)) {
          setCurrentPage('subscription-required');
          window.location.hash = 'subscription-required';
          return;
        }
        setCurrentPage(hash);
        return;
      }
      
      // Si pas de hash ou hash invalide, et qu'on n'est pas déjà sur dashboard, aller au dashboard
      if ((!hash || !(VALID_HASH_PAGES as readonly string[]).includes(hash)) && page !== 'dashboard') {
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
    const currentHashRaw = window.location.hash.replace('#', '').trim();
    const currentHash = currentHashRaw.split('?')[0];
    const page = currentPageRef.current;
    
    if (currentHash && (VALID_HASH_PAGES as readonly string[]).includes(currentHash)) {
      if (lockedPremiumPages.has(currentHash)) {
        window.location.hash = 'subscription-required';
        setCurrentPage('subscription-required');
        return;
      }
      // Si le hash est valide et différent de la page actuelle, mettre à jour
      if (currentHash !== page) {
        setCurrentPage(currentHash);
      }
    } else if (!currentHash || !(VALID_HASH_PAGES as readonly string[]).includes(currentHash)) {
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
  }, [currentUser, lockedPremiumPages]); // Ne pas inclure currentPage pour éviter les boucles

  // Gérer les événements de changement d'utilisateur - séparé pour éviter les conflits
  useEffect(() => {
    const handleUserLogin = (event: Event) => {
      const user = (event as CustomEvent).detail?.user;
      if (!user) return;
      void loadAppSettings();
      setCurrentUser(user);
      window.location.hash = 'dashboard';
      setCurrentPage('dashboard');
    };

    const handleUserLogout = () => {
      setCurrentUser(null);
      setAppSettings(null);
      setBillingStatus(null);
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
  }, [loadAppSettings]);

  const renderPage = () => {
    // Vérifier si on est sur la page d'activation
    const pathname = window.location.pathname;
    if (pathname === '/strategy-checklist') {
      if (!currentUser || lockedPremiumPages.has('strategies')) {
        return <SubscriptionRequiredPage onBackToDashboard={() => {
          window.location.hash = 'dashboard';
          setCurrentPage('dashboard');
        }} />;
      }
      return <LazyPage><StrategyChecklistPopup /></LazyPage>;
    }

    if (pathname === '/calculator-popup') {
      if (!currentUser || lockedPremiumPages.has('calculator')) {
        return <SubscriptionRequiredPage onBackToDashboard={() => {
          window.location.hash = 'dashboard';
          setCurrentPage('dashboard');
        }} />;
      }
      return <LazyPage><CalculatorPopup /></LazyPage>;
    }

    
    const activateMatch = pathname.match(/^\/activate-account\/([^/]+)\/?$/);
    if (activateMatch) {
      const token = activateMatch[1];
      return <LazyPage><ActivateAccountPage token={token} /></LazyPage>;
    }

    // Pages publiques accessibles via pathname (SEO) - Support multilingue
    const aboutPaths = ['/a-propos', '/about', '/acerca-de', '/uber-uns'];
    const featuresPaths = ['/fonctionnalites', '/features', '/funcionalidades', '/funktionen'];
    
    if (aboutPaths.includes(pathname)) {
      return <LazyPage><AboutPage /></LazyPage>;
    }
    if (featuresPaths.includes(pathname)) {
      return <LazyPage><FeaturesPage /></LazyPage>;
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
            return <LazyPage><TradesPage /></LazyPage>;
          case 'calendar':
            return <LazyPage><CalendarPage /></LazyPage>;
          case 'daily-journal':
            return <LazyPage><DailyJournalPage /></LazyPage>;
          case 'session-replay':
            if (lockedPremiumPages.has('session-replay')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return <LazyPage><SessionReplayPage /></LazyPage>;
          case 'statistics':
            if (lockedPremiumPages.has('statistics')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return <LazyPage><StatisticsPage /></LazyPage>;
          case 'strategies':
            if (lockedPremiumPages.has('strategies')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return (
              <LazyPage>
                <StrategiesPage />
              </LazyPage>
            );
          case 'position-strategies':
            if (lockedPremiumPages.has('position-strategies')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return <LazyPage><PositionStrategiesPage /></LazyPage>;
          case 'analytics':
            if (lockedPremiumPages.has('analytics')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return <LazyPage><AnalyticsPage /></LazyPage>;
          case 'behavior':
            if (lockedPremiumPages.has('behavior')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return <LazyPage><BehaviorPage /></LazyPage>;
          case 'accounts':
            return <LazyPage><TradingAccountsPage /></LazyPage>;
          case 'transactions':
            return <LazyPage><TransactionsPage /></LazyPage>;
          case 'trading-activity':
            if (lockedPremiumPages.has('trading-activity')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return <LazyPage><TradingActivityPage /></LazyPage>;
          case 'goals':
            if (lockedPremiumPages.has('goals')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return <LazyPage><GoalsPage /></LazyPage>;
          case 'calculator':
            if (lockedPremiumPages.has('calculator')) {
              return <SubscriptionRequiredPage onBackToDashboard={() => {
                window.location.hash = 'dashboard';
                setCurrentPage('dashboard');
              }} />;
            }
            return <LazyPage><CalculatorPage /></LazyPage>;
          case 'billing':
          case 'billing-success':
          case 'billing-cancel':
            if (!premiumRestrictionsEnabled) {
              return <DashboardPage currentUser={currentUser} />;
            }
            return <LazyPage><BillingPage billingStatus={billingStatus} onSubscriptionChanged={refreshBillingStatus} /></LazyPage>;
          case 'subscription-required':
            return <LazyPage><SubscriptionRequiredPage onBackToDashboard={() => {
              window.location.hash = 'dashboard';
              setCurrentPage('dashboard');
            }} /></LazyPage>;
          case 'users':
            return <LazyPage><UserManagementPage /></LazyPage>;
          case 'settings':
            return (
              <LazyPage>
                <SettingsPage
                premiumRestrictionsEnabled={premiumRestrictionsSetting}
                onPremiumRestrictionsChange={async (enabled) => {
                  const updated = await userService.updateAppSettings({
                    premium_restrictions_enabled: enabled,
                  });
                  setAppSettings(updated);
                  window.dispatchEvent(
                    new CustomEvent('app:settings-updated', { detail: { appSettings: updated } })
                  );
                }}
              />
              </LazyPage>
            );
          case 'legal-notice':
            return <LazyPage><LegalNoticePage /></LazyPage>;
          case 'dashboard':
          default:
            return <DashboardPage currentUser={currentUser} />;
        }
  };

  const handleNavigate = (page: string) => {
    if (lockedPremiumPages.has(page)) {
      window.location.hash = 'subscription-required';
      setCurrentPage('subscription-required');
      return;
    }

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
    <ComplianceRefreshProvider>
    <ImageLightboxProvider>
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
          lockedPremiumPages={lockedPremiumPages}
          billingStatusLabel={billingStatusLabel}
          premiumRestrictionsEnabled={premiumRestrictionsEnabled}
          topBanner={
            premiumRestrictionsEnabled && billingStatus && !currentUser.is_admin ? (
              <div
                className="w-full border-b border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/30 px-3 sm:px-6 py-2.5"
                aria-live="polite"
              >
                <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {billingStatus.access_state === 'trialing'
                      ? t('billing:banner.trialDaysLeft', { count: billingStatus.trial_days_left })
                      : billingStatus.access_state === 'inactive'
                        ? t('billing:banner.trialEnded')
                        : t('billing:banner.active')}
                  </p>
                  {(billingStatus.access_state === 'trialing' || billingStatus.access_state === 'inactive') && (
                    <button
                      type="button"
                      className="self-start sm:self-auto rounded-lg bg-blue-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-blue-700 transition"
                      onClick={() => handleNavigate('billing')}
                      disabled={billingLoading}
                    >
                      {billingLoading ? t('billing:cta.loading') : t('billing:cta.subscribe')}
                    </button>
                  )}
                </div>
                {billingError && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    {t('billing:errors.statusUnavailable')}
                  </p>
                )}
              </div>
            ) : null
          }
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
    </ImageLightboxProvider>
    </ComplianceRefreshProvider>
  );
}

// Wrapper pour gérer les routes spéciales sans Layout
function AppRouter() {
  return <App />;
}

export default AppRouter;