import React, { useState, useEffect, useMemo } from 'react';
import userService, { UserPreferences, ActiveSession, LoginHistoryEntry, PasswordChangeData } from '../services/userService';
import authService from '../services/auth';
import { changeLanguage } from '../i18n/config';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { CustomSelect } from '../components/common/CustomSelect';
import PaginationControls from '../components/ui/PaginationControls';

const TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'America/Sao_Paulo',
];

const SettingsPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'trading' | 'display' | 'data'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profil
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
  });

  // Préférences
  const [preferences, setPreferences] = useState<UserPreferences>({
    language: 'fr',
    timezone: 'Europe/Paris',
    date_format: 'EU',
    number_format: 'comma',
    theme: 'light',
    font_size: 'medium',
    email_goal_alerts: true,
  });

  // Sécurité
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  });
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(5);

  // Suppression de compte
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger le profil
      const userProfile = await userService.getCurrentUserProfile();
      setProfile({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        email: userProfile.email || '',
        username: userProfile.username || '',
      });

      // Charger les préférences
      try {
        const prefs = await userService.getPreferences();
        setPreferences(prefs);
      } catch {
        // Les préférences n'existent pas encore, utiliser les valeurs par défaut
      }

      // Charger les sessions et l'historique
      loadSecurityData();
    } catch (error: any) {
      showMessage('error', error.message || t('common:error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSecurityData = async () => {
    try {
      const [sessionsData, historyData] = await Promise.all([
        userService.getActiveSessions(),
        userService.getLoginHistory(50),
      ]);
      setSessions(sessionsData);
      setLoginHistory(historyData);
    } catch (error: any) {
      console.error('Erreur lors du chargement des données de sécurité:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await userService.updateCurrentUserProfile(profile);
      showMessage('success', t('settings:profileUpdated'));
      
      // Mettre à jour l'utilisateur dans authService et localStorage
      if (result.user) {
        authService.updateUser(result.user);
        // Déclencher un événement pour mettre à jour l'interface
        window.dispatchEvent(new CustomEvent('user:profile-updated', { 
          detail: { user: result.user } 
        }));
      }
    } catch (error: any) {
      showMessage('error', error.message || t('settings:errorProfileUpdate'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.new_password_confirm) {
      showMessage('error', t('settings:passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await userService.changePassword(passwordForm as PasswordChangeData);
      showMessage('success', t('settings:passwordUpdated'));
      setPasswordForm({ old_password: '', new_password: '', new_password_confirm: '' });
    } catch (error: any) {
      showMessage('error', error.message || t('settings:errorPasswordChange'));
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    console.log('[SettingsPage] 💾 Sauvegarde des préférences...', preferences);
    setLoading(true);
    try {
      const updatedPreferences = await userService.updatePreferences(preferences);
      console.log('[SettingsPage] ✅ Préférences sauvegardées:', updatedPreferences);
      showMessage('success', t('settings:preferencesUpdated'));
      // Appliquer le thème immédiatement si changé
      if (updatedPreferences.theme) {
        setTheme(updatedPreferences.theme as 'light' | 'dark');
      }
      // Appliquer la taille de police immédiatement si changée
      if (updatedPreferences.font_size) {
        const root = document.documentElement;
        root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        root.classList.add(`font-size-${updatedPreferences.font_size}`);
        // Sauvegarder dans localStorage
        try {
          localStorage.setItem('font_size', updatedPreferences.font_size);
        } catch (e) {
          // Ignorer les erreurs de localStorage
        }
      }
      // Changer la langue i18n si elle a changé
      if (updatedPreferences.language) {
        console.log('[SettingsPage] 🌐 Changement de langue vers:', updatedPreferences.language);
        changeLanguage(updatedPreferences.language);
      }
      // Mettre à jour les préférences locales avec la réponse du serveur
      setPreferences(updatedPreferences);
      // Déclencher un événement pour rafraîchir les préférences dans tous les composants
      console.log('[SettingsPage] 📢 Dispatch event preferences:updated');
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error: any) {
      console.error('[SettingsPage] ❌ Erreur sauvegarde:', error);
      showMessage('error', error.message || t('settings:errorPreferencesUpdate'));
    } finally {
      setLoading(false);
    }
  };

  const handleThemeToggle = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    // Mettre à jour localement immédiatement pour un feedback instantané
    setPreferences({ ...preferences, theme: newTheme });
    // Appliquer le thème immédiatement
    await setTheme(newTheme);
    // Sauvegarder sur le serveur en arrière-plan
    try {
      await userService.updatePreferences({ ...preferences, theme: newTheme });
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde du thème:', error);
      // Revenir en arrière en cas d'erreur
      const previousTheme = theme;
      setPreferences({ ...preferences, theme: previousTheme });
      await setTheme(previousTheme);
      showMessage('error', t('settings:errorThemeSave'));
    }
  };

  const handleRevokeSession = async (jti: string) => {
    if (!window.confirm(t('settings:disconnect') + '?')) return;
    setLoading(true);
    try {
      await userService.revokeSession(jti);
      showMessage('success', t('settings:sessionRevoked'));
      await loadSecurityData();
    } catch (error: any) {
      showMessage('error', error.message || t('settings:errorSessionDisconnect'));
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm(t('settings:disconnectAllOther') + '?')) return;
    setLoading(true);
    try {
      await userService.revokeAllOtherSessions();
      showMessage('success', t('settings:allSessionsRevoked'));
      await loadSecurityData();
    } catch (error: any) {
      showMessage('error', error.message || t('settings:errorSessionsDisconnect'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setLoading(true);
    try {
      const blob = await userService.exportData();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trading_journal_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showMessage('success', t('settings:dataExported'));
    } catch (error: any) {
      showMessage('error', error.message || t('settings:errorDataExport'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') {
      showMessage('error', t('settings:deleteConfirmPrompt'));
      return;
    }
    if (!window.confirm(t('settings:deleteAccountWarning'))) return;
    
    setLoading(true);
    try {
      await userService.deleteCurrentUserAccount();
      showMessage('success', t('settings:accountDeleted'));
      setTimeout(() => {
        authService.logout();
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      showMessage('error', error.message || t('settings:errorAccountDelete'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: preferences.timezone,
    });
  };

  // Pagination de l'historique des connexions
  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * historyPageSize;
    const endIndex = startIndex + historyPageSize;
    return loginHistory.slice(startIndex, endIndex);
  }, [loginHistory, historyPage, historyPageSize]);

  const tabs = [
    { id: 'profile' as const, label: t('settings:profile'), icon: '👤' },
    { id: 'security' as const, label: t('settings:security'), icon: '🔒' },
    { id: 'trading' as const, label: t('settings:trading'), icon: '📊' },
    { id: 'display' as const, label: t('settings:display'), icon: '🎨' },
    { id: 'data' as const, label: t('settings:data'), icon: '💾' },
  ];

  return (
    <div className="h-full flex flex-col -my-6 relative">
      {message && (
        <div className={`m-3 sm:m-4 p-3 sm:p-4 rounded-lg text-xs sm:text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-3 sm:px-4 md:px-6 lg:px-8 bg-white dark:bg-gray-800">
        <nav className="-mb-px flex space-x-4 sm:space-x-6 md:space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
            >
              <span className="mr-1 sm:mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="flex-1 overflow-y-auto overflow-x-visible bg-white dark:bg-gray-900 p-3 sm:p-4 md:p-6 lg:p-8">
        {loading && (
          <div className="mb-4 text-gray-600 dark:text-gray-400">{t('common:loading')}</div>
        )}

        {/* Profil */}
        {activeTab === 'profile' && (
          <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">{t('settings:profileInfo')}</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4 sm:space-y-6 max-w-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:firstName')}</label>
                    <input
                      type="text"
                      value={profile.first_name}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:lastName')}</label>
                    <input
                      type="text"
                      value={profile.last_name}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:email')}</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:username')}</label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {t('settings:saveChanges')}
                </button>
              </form>
          </div>
        )}

        {/* Sécurité */}
        {activeTab === 'security' && (
          <div className="space-y-6 sm:space-y-8">
              {/* Changement de mot de passe */}
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">{t('settings:changePassword')}</h2>
                <form onSubmit={handlePasswordChange} className="space-y-3 sm:space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:oldPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.old_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:newPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:confirmNewPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.new_password_confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {t('settings:updatePassword')}
                  </button>
                </form>
              </div>

              {/* Sessions actives */}
              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-3 sm:mb-4">
                  <button
                    onClick={() => setSessionsExpanded(!sessionsExpanded)}
                    className="flex items-center text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <svg
                      className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 transition-transform ${sessionsExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {t('settings:activeSessions')}
                    <span className="ml-2 px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                      {sessions.length}
                    </span>
                  </button>
                  {sessionsExpanded && sessions.length > 1 && (
                    <button
                      onClick={handleRevokeAllSessions}
                      className="w-full sm:w-auto px-3 py-1.5 sm:py-1 text-sm sm:text-base bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                    >
                      {t('settings:disconnectAllOther')}
                    </button>
                  )}
                </div>
                {sessionsExpanded && (
                  <div className="space-y-3">
                    {sessions.length === 0 ? (
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 py-4">{t('settings:noActiveSessions')}</p>
                    ) : (
                      sessions.map((session) => (
                        <div
                          key={session.jti}
                          className={`p-3 sm:p-4 border rounded-md ${
                            session.is_current 
                              ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words">
                                {session.device_info || t('settings:unknownDevice')}
                                {session.is_current && (
                                  <span className="ml-2 px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">{t('settings:currentSession')}</span>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                                {t('settings:createdOn')} {formatDate(session.created_at)}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                                {t('settings:expiresOn')} {formatDate(session.expires_at)}
                              </div>
                            </div>
                            {!session.is_current && (
                              <button
                                onClick={() => handleRevokeSession(session.jti)}
                                className="w-full sm:w-auto px-3 py-1.5 sm:py-1 text-sm sm:text-base text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                              >
                                {t('settings:disconnect')}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Historique des connexions */}
              <div>
                <button
                  onClick={() => {
                    setHistoryExpanded(!historyExpanded);
                    if (!historyExpanded) {
                      setHistoryPage(1);
                    }
                  }}
                  className="flex items-center text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 mb-3 sm:mb-4"
                >
                  <svg
                    className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 transition-transform ${historyExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {t('settings:loginHistory')}
                  <span className="ml-2 px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                    {loginHistory.length}
                  </span>
                </button>
                {historyExpanded && (
                  <>
                    {loginHistory.length === 0 ? (
                      <div className="text-center py-8 sm:py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('settings:noLoginHistory')}</p>
                        <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-2">{t('settings:loginHistoryInfo')}</p>
                      </div>
                    ) : (
                      <>
                        {/* Mobile Card View */}
                        <div className="block md:hidden space-y-3">
                          {paginatedHistory.map((entry, index) => (
                            <div
                              key={index}
                              className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                              <div className="space-y-2">
                                <div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('settings:date')}</div>
                                  <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 break-words">{formatDate(entry.date)}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('settings:ip')}</div>
                                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">{entry.ip_address || t('common:na')}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('settings:device')}</div>
                                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">{entry.user_agent || t('common:na')}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('settings:status')}</div>
                                  <span className={`inline-flex px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full ${
                                    entry.success 
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                  }`}>
                                    {entry.success ? t('settings:success') : t('settings:failed')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                              <tr>
                                <th className="px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings:date')}</th>
                                <th className="px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings:ip')}</th>
                                <th className="px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings:device')}</th>
                                <th className="px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings:status')}</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                              {paginatedHistory.map((entry, index) => (
                                <tr key={index}>
                                  <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100">{formatDate(entry.date)}</td>
                                  <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600 dark:text-gray-400">{entry.ip_address || t('common:na')}</td>
                                  <td className="px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={entry.user_agent || t('common:na')}>{entry.user_agent || t('common:na')}</td>
                                  <td className="px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-[10px] sm:text-xs leading-5 font-semibold rounded-full ${
                                      entry.success 
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                    }`}>
                                      {entry.success ? t('settings:success') : t('settings:failed')}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {loginHistory.length > historyPageSize && (
                          <PaginationControls
                            currentPage={historyPage}
                            totalPages={Math.max(1, Math.ceil(loginHistory.length / historyPageSize))}
                            totalItems={loginHistory.length}
                            itemsPerPage={historyPageSize}
                            startIndex={(historyPage - 1) * historyPageSize + 1}
                            endIndex={Math.min(historyPage * historyPageSize, loginHistory.length)}
                            onPageChange={(page) => setHistoryPage(page)}
                            onPageSizeChange={(size) => {
                              setHistoryPageSize(size);
                              setHistoryPage(1);
                            }}
                            pageSizeOptions={[5, 10, 25, 50]}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
          </div>
        )}

        {/* Préférences de trading */}
        {activeTab === 'trading' && (
          <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">{t('settings:tradingPreferences')}</h2>
              <div className="space-y-4 sm:space-y-6 max-w-md">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:dateFormat')}</label>
                  <CustomSelect
                    value={preferences.date_format}
                    onChange={(value) => setPreferences({ ...preferences, date_format: value as 'US' | 'EU' })}
                    options={[
                      { value: 'EU', label: t('settings:dateFormatEU') },
                      { value: 'US', label: t('settings:dateFormatUS') },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:numberFormat')}</label>
                  <CustomSelect
                    value={preferences.number_format}
                    onChange={(value) => setPreferences({ ...preferences, number_format: value as 'point' | 'comma' })}
                    options={[
                      { value: 'comma', label: t('settings:numberFormatComma') },
                      { value: 'point', label: t('settings:numberFormatPoint') },
                    ]}
                  />
                </div>
                <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">{t('settings:notifications', { defaultValue: 'Notifications' })}</h3>
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <label htmlFor="email_goal_alerts" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('settings:emailGoalAlerts', { defaultValue: 'Alertes email pour les objectifs' })}
                      </label>
                      <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 break-words">
                        {t('settings:emailGoalAlertsDescription', { defaultValue: 'Recevoir des emails quand un objectif est atteint ou en danger' })}
                      </p>
                    </div>
                    <input
                      id="email_goal_alerts"
                      type="checkbox"
                      checked={preferences.email_goal_alerts !== false}
                      onChange={(e) => setPreferences({ ...preferences, email_goal_alerts: e.target.checked })}
                      className="h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 bg-white dark:bg-gray-700 flex-shrink-0 mt-0.5 sm:mt-0"
                    />
                  </div>
                </div>
                <button
                  onClick={handlePreferencesUpdate}
                  disabled={loading}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {t('settings:savePreferences')}
                </button>
              </div>
          </div>
        )}

        {/* Préférences d'affichage */}
        {activeTab === 'display' && (
          <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">{t('settings:displayPreferences')}</h2>
              <div className="space-y-4 sm:space-y-6 max-w-md">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:timezone')}</label>
                  <CustomSelect
                    value={preferences.timezone}
                    onChange={(value) => setPreferences({ ...preferences, timezone: value as string })}
                    options={TIMEZONES.map(tz => ({ value: tz, label: tz }))}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">{t('settings:theme')}</label>
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <span className={`text-xs sm:text-sm ${theme === 'light' ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t('settings:themeLight')}
                    </span>
                    <button
                      type="button"
                      onClick={handleThemeToggle}
                      className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      role="switch"
                      aria-checked={theme === 'dark'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          theme === 'dark' ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t('settings:themeDark')}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('settings:fontSize')}</label>
                  <CustomSelect
                    value={preferences.font_size}
                    onChange={(value) => setPreferences({ ...preferences, font_size: value as 'small' | 'medium' | 'large' })}
                    options={[
                      { value: 'small', label: t('settings:fontSizeSmall') },
                      { value: 'medium', label: t('settings:fontSizeMedium') },
                      { value: 'large', label: t('settings:fontSizeLarge') },
                    ]}
                  />
                </div>

                <button
                  onClick={handlePreferencesUpdate}
                  disabled={loading}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {t('settings:savePreferences')}
                </button>
              </div>
          </div>
        )}

        {/* Données et confidentialité */}
        {activeTab === 'data' && (
          <div className="space-y-6 sm:space-y-8">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 sm:mb-6">{t('settings:dataExport')}</h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 break-words">
                  {t('settings:dataExportDescription')}
                </p>
                <button
                  onClick={handleExportData}
                  disabled={loading}
                  className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {t('settings:exportMyData')}
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 sm:pt-8">
                <h2 className="text-lg sm:text-xl font-semibold text-red-900 dark:text-red-400 mb-4 sm:mb-6">{t('settings:dangerZone')}</h2>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-red-900 dark:text-red-400 mb-2">{t('settings:deleteAccount')}</h3>
                  <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mb-3 sm:mb-4 break-words">
                    {t('settings:deleteAccountWarning')}
                  </p>
                  <ul className="list-disc list-inside text-xs sm:text-sm text-red-700 dark:text-red-300 mb-3 sm:mb-4 space-y-1">
                    <li>{t('settings:deleteAccountList1')}</li>
                    <li>{t('settings:deleteAccountList2')}</li>
                    <li>{t('settings:deleteAccountList3')}</li>
                    <li>{t('settings:deleteAccountList4')}</li>
        </ul>
                  {!showDeleteModal ? (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                    >
                      {t('settings:deleteAccountButton')}
                    </button>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-red-900 dark:text-red-400 mb-1.5 sm:mb-2">
                          {t('settings:deleteConfirmPrompt')}
                        </label>
                        <input
                          type="text"
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border border-red-300 dark:border-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          placeholder="SUPPRIMER"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:space-x-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={loading || deleteConfirm !== 'SUPPRIMER'}
                          className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
                        >
                          {t('settings:confirmDeletion')}
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteModal(false);
                            setDeleteConfirm('');
                          }}
                          className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                        >
                          {t('common:cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
