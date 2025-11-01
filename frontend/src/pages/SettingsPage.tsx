import React, { useState, useEffect } from 'react';
import userService, { UserPreferences, ActiveSession, LoginHistoryEntry, PasswordChangeData } from '../services/userService';
import authService from '../services/auth';
import { changeLanguage } from '../i18n/config';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

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
      showMessage('success', result.message || t('settings:profileUpdated'));
      
      // Mettre à jour l'utilisateur dans authService et localStorage
      if (result.user) {
        authService.updateUser(result.user);
        // Déclencher un événement pour mettre à jour l'interface
        window.dispatchEvent(new CustomEvent('user:profile-updated', { 
          detail: { user: result.user } 
        }));
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.new_password_confirm) {
      showMessage('error', t('settings:passwordMismatch', { defaultValue: 'Les mots de passe ne correspondent pas' }));
      return;
    }
    setLoading(true);
    try {
      await userService.changePassword(passwordForm as PasswordChangeData);
      showMessage('success', t('settings:passwordUpdated'));
      setPasswordForm({ old_password: '', new_password: '', new_password_confirm: '' });
    } catch (error: any) {
      showMessage('error', error.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    setLoading(true);
    try {
      const updatedPreferences = await userService.updatePreferences(preferences);
      showMessage('success', t('settings:preferencesUpdated'));
      // Appliquer le thème immédiatement si changé
      if (updatedPreferences.theme) {
        setTheme(updatedPreferences.theme as 'light' | 'dark');
      }
      // Changer la langue i18n si elle a changé
      if (updatedPreferences.language) {
        changeLanguage(updatedPreferences.language);
      }
      // Mettre à jour les préférences locales avec la réponse du serveur
      setPreferences(updatedPreferences);
      // Déclencher un événement pour rafraîchir les préférences dans tous les composants
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error: any) {
      showMessage('error', error.message || 'Erreur lors de la mise à jour des préférences');
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
      showMessage('error', 'Erreur lors de la sauvegarde du thème');
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
      showMessage('error', error.message || 'Erreur lors de la déconnexion de la session');
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
      showMessage('error', error.message || 'Erreur lors de la déconnexion des sessions');
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
      showMessage('error', error.message || 'Erreur lors de l\'export des données');
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
      showMessage('error', error.message || 'Erreur lors de la suppression du compte');
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

  const tabs = [
    { id: 'profile' as const, label: t('settings:profile'), icon: '👤' },
    { id: 'security' as const, label: t('settings:security'), icon: '🔒' },
    { id: 'trading' as const, label: t('settings:trading'), icon: '📊' },
    { id: 'display' as const, label: t('settings:display'), icon: '🎨' },
    { id: 'data' as const, label: t('settings:data'), icon: '💾' },
  ];

  return (
    <div className="h-full flex flex-col -my-6">
      {message && (
        <div className={`m-4 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex-shrink-0`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        {loading && (
          <div className="mb-4 text-gray-600 dark:text-gray-400">{t('common:loading')}</div>
        )}

        {/* Profil */}
        {activeTab === 'profile' && (
          <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">{t('settings:profileInfo')}</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:firstName')}</label>
                    <input
                      type="text"
                      value={profile.first_name}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:lastName')}</label>
                    <input
                      type="text"
                      value={profile.last_name}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:email')}</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:username')}</label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {t('settings:saveChanges')}
                </button>
              </form>
          </div>
        )}

        {/* Sécurité */}
        {activeTab === 'security' && (
          <div className="space-y-8">
              {/* Changement de mot de passe */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">{t('settings:changePassword')}</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:oldPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.old_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:newPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:confirmNewPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.new_password_confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {t('settings:updatePassword')}
                  </button>
                </form>
              </div>

              {/* Sessions actives */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setSessionsExpanded(!sessionsExpanded)}
                    className="flex items-center text-xl font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    <svg
                      className={`w-5 h-5 mr-2 transition-transform ${sessionsExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {t('settings:activeSessions')}
                    <span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                      {sessions.length}
                    </span>
                  </button>
                  {sessionsExpanded && sessions.length > 1 && (
                    <button
                      onClick={handleRevokeAllSessions}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                    >
                      {t('settings:disconnectAllOther')}
                    </button>
                  )}
                </div>
                {sessionsExpanded && (
                  <div className="space-y-3">
                    {sessions.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 py-4">{t('settings:noActiveSessions')}</p>
                    ) : (
                      sessions.map((session) => (
                        <div
                          key={session.jti}
                          className={`p-4 border rounded-md ${
                            session.is_current 
                              ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {session.device_info || t('settings:unknownDevice')}
                                {session.is_current && (
                                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">{t('settings:currentSession')}</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {t('settings:createdOn')} {formatDate(session.created_at)}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {t('settings:expiresOn')} {formatDate(session.expires_at)}
                              </div>
                            </div>
                            {!session.is_current && (
                              <button
                                onClick={() => handleRevokeSession(session.jti)}
                                className="px-3 py-1 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
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
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="flex items-center text-xl font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
                >
                  <svg
                    className={`w-5 h-5 mr-2 transition-transform ${historyExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {t('settings:loginHistory')}
                  <span className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                    {loginHistory.length}
                  </span>
                </button>
                {historyExpanded && (
                  <>
                    {loginHistory.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">{t('settings:noLoginHistory')}</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">{t('settings:loginHistoryInfo')}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings:date')}</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings:ip')}</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings:device')}</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings:status')}</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {loginHistory.map((entry, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatDate(entry.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{entry.ip_address || t('common:na')}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={entry.user_agent || t('common:na')}>{entry.user_agent || t('common:na')}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
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
                    )}
                  </>
                )}
              </div>
          </div>
        )}

        {/* Préférences de trading */}
        {activeTab === 'trading' && (
          <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">{t('settings:tradingPreferences')}</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:dateFormat')}</label>
                  <select
                    value={preferences.date_format}
                    onChange={(e) => setPreferences({ ...preferences, date_format: e.target.value as 'US' | 'EU' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="EU">{t('settings:dateFormatEU')}</option>
                    <option value="US">{t('settings:dateFormatUS')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:numberFormat')}</label>
                  <select
                    value={preferences.number_format}
                    onChange={(e) => setPreferences({ ...preferences, number_format: e.target.value as 'point' | 'comma' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="comma">{t('settings:numberFormatComma')}</option>
                    <option value="point">{t('settings:numberFormatPoint')}</option>
                  </select>
                </div>
                <button
                  onClick={handlePreferencesUpdate}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {t('settings:savePreferences')}
                </button>
              </div>
          </div>
        )}

        {/* Préférences d'affichage */}
        {activeTab === 'display' && (
          <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">{t('settings:displayPreferences')}</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:language')}</label>
                  <select
                    value={preferences.language}
                    onChange={(e) => setPreferences({ ...preferences, language: e.target.value as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="de">Deutsch</option>
                    <option value="it">Italiano</option>
                    <option value="pt">Português</option>
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                    <option value="zh">中文</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:timezone')}</label>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('settings:theme')}</label>
                  <div className="flex items-center space-x-4">
                    <span className={`text-sm ${theme === 'light' ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t('settings:themeLight')}
                    </span>
                    <button
                      type="button"
                      onClick={handleThemeToggle}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      role="switch"
                      aria-checked={theme === 'dark'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t('settings:themeDark')}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings:fontSize')}</label>
                  <select
                    value={preferences.font_size}
                    onChange={(e) => setPreferences({ ...preferences, font_size: e.target.value as 'small' | 'medium' | 'large' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="small">{t('settings:fontSizeSmall')}</option>
                    <option value="medium">{t('settings:fontSizeMedium')}</option>
                    <option value="large">{t('settings:fontSizeLarge')}</option>
                  </select>
                </div>
                <button
                  onClick={handlePreferencesUpdate}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {t('settings:savePreferences')}
                </button>
              </div>
          </div>
        )}

        {/* Données et confidentialité */}
        {activeTab === 'data' && (
          <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">{t('settings:dataExport')}</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t('settings:dataExportDescription')}
                </p>
                <button
                  onClick={handleExportData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {t('settings:exportMyData')}
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                <h2 className="text-xl font-semibold text-red-900 dark:text-red-400 mb-6">{t('settings:dangerZone')}</h2>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-2">{t('settings:deleteAccount')}</h3>
                  <p className="text-red-700 dark:text-red-300 mb-4">
                    {t('settings:deleteAccountWarning')}
                  </p>
                  <ul className="list-disc list-inside text-red-700 dark:text-red-300 mb-4 space-y-1">
                    <li>{t('settings:deleteAccountList1')}</li>
                    <li>{t('settings:deleteAccountList2')}</li>
                    <li>{t('settings:deleteAccountList3')}</li>
                    <li>{t('settings:deleteAccountList4')}</li>
        </ul>
                  {!showDeleteModal ? (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                    >
                      {t('settings:deleteAccountButton')}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-red-900 dark:text-red-400 mb-2">
                          {t('settings:deleteConfirmPrompt')}
                        </label>
                        <input
                          type="text"
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          placeholder="SUPPRIMER"
                        />
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={loading || deleteConfirm !== 'SUPPRIMER'}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
                        >
                          {t('settings:confirmDeletion')}
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteModal(false);
                            setDeleteConfirm('');
                          }}
                          className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
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
