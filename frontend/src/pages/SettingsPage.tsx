import React, { useState, useEffect, useMemo } from 'react';
import userService, { UserPreferences, ActiveSession, LoginHistoryEntry, PasswordChangeData } from '../services/userService';
import authService from '../services/auth';
import { changeLanguage } from '../i18n/config';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { CustomSelect } from '../components/common/CustomSelect';
import PaginationControls from '../components/ui/PaginationControls';

import { SettingsLayout } from '../components/settings/SettingsLayout';
import { SettingsSidebar } from '../components/settings/SettingsSidebar';
import { SettingsSection } from '../components/settings/SettingsSection';
import { SettingsInput } from '../components/settings/SettingsInput';
import { UnsavedChangesBar } from '../components/settings/UnsavedChangesBar';
import { PasswordStrengthMeter } from '../components/settings/PasswordStrengthMeter';
import { SessionCard } from '../components/settings/SessionCard';
import { DangerZoneCard } from '../components/settings/DangerZoneCard';
import { SettingsToast } from '../components/settings/SettingsToast';

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);

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
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(5);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const userProfile = await userService.getCurrentUserProfile();
      const profileData = {
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        email: userProfile.email || '',
        username: userProfile.username || '',
      };
      setProfile(profileData);

      try {
        const prefs = await userService.getPreferences();
        setPreferences(prefs);
        setInitialData({ profile: profileData, preferences: prefs });
      } catch {
        setInitialData({ profile: profileData, preferences });
      }

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

  // Détecter les changements non sauvegardés
  useEffect(() => {
    if (!initialData) return;
    
    const profileChanged = JSON.stringify(profile) !== JSON.stringify(initialData.profile);
    const preferencesChanged = JSON.stringify(preferences) !== JSON.stringify(initialData.preferences);
    
    setHasUnsavedChanges(profileChanged || preferencesChanged);
  }, [profile, preferences, initialData]);

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
  };

  const handleProfileUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const result = await userService.updateCurrentUserProfile(profile);
      showMessage('success', t('settings:profileUpdated'));
      
      if (result.user) {
        authService.updateUser(result.user);
        window.dispatchEvent(new CustomEvent('user:profile-updated', { 
          detail: { user: result.user } 
        }));
      }
      
      setInitialData({ ...initialData, profile });
      setHasUnsavedChanges(false);
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
    setLoading(true);
    try {
      const updatedPreferences = await userService.updatePreferences(preferences);
      showMessage('success', t('settings:preferencesUpdated'));
      
      if (updatedPreferences.theme) {
        setTheme(updatedPreferences.theme as 'light' | 'dark');
      }
      
      if (updatedPreferences.font_size) {
        const root = document.documentElement;
        root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        root.classList.add(`font-size-${updatedPreferences.font_size}`);
        try {
          localStorage.setItem('font_size', updatedPreferences.font_size);
        } catch (e) {}
      }
      
      if (updatedPreferences.language) {
        changeLanguage(updatedPreferences.language);
      }
      
      setPreferences(updatedPreferences);
      setInitialData({ ...initialData, preferences: updatedPreferences });
      setHasUnsavedChanges(false);
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error: any) {
      showMessage('error', error.message || t('settings:errorPreferencesUpdate'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (activeTab === 'profile') {
      await handleProfileUpdate();
    } else if (activeTab === 'trading' || activeTab === 'display') {
      await handlePreferencesUpdate();
    }
  };

  const handleDiscardChanges = () => {
    if (initialData) {
      setProfile(initialData.profile);
      setPreferences(initialData.preferences);
      setHasUnsavedChanges(false);
    }
  };

  const handleThemeToggle = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setPreferences({ ...preferences, theme: newTheme });
    await setTheme(newTheme);
    
    try {
      await userService.updatePreferences({ ...preferences, theme: newTheme });
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error: any) {
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
    try {
      await userService.deleteCurrentUserAccount();
      showMessage('success', t('settings:accountDeleted'));
      setTimeout(() => {
        authService.logout();
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      showMessage('error', error.message || t('settings:errorAccountDelete'));
      throw error;
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

  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * historyPageSize;
    const endIndex = startIndex + historyPageSize;
    return loginHistory.slice(startIndex, endIndex);
  }, [loginHistory, historyPage, historyPageSize]);

  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, 3);
  const visibleHistory = showAllHistory ? paginatedHistory : paginatedHistory.slice(0, 3);

  const tabs = [
    {
      id: 'profile' as const,
      label: t('settings:profile'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'security' as const,
      label: t('settings:security'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      badge: sessions.length,
    },
    {
      id: 'trading' as const,
      label: t('settings:trading'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'display' as const,
      label: t('settings:display'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'data' as const,
      label: t('settings:data'),
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
    },
  ];

  return (
    <SettingsLayout
      sidebar={
        <SettingsSidebar
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as any)}
          tabs={tabs}
        />
      }
      header={
        message && (
          <SettingsToast
            type={message.type}
            message={message.text}
            onClose={() => setMessage(null)}
          />
        )
      }
    >
      <div className="space-y-6">
        {/* Section Profil */}
        {activeTab === 'profile' && (
          <SettingsSection
            title={t('settings:profileInfo')}
            description={t('settings:profileInfoDesc', { defaultValue: 'Gérez vos informations personnelles' })}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          >
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SettingsInput
                  label={t('settings:firstName')}
                  value={profile.first_name}
                  onChange={(value) => setProfile({ ...profile, first_name: value })}
                  required
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                />
                <SettingsInput
                  label={t('settings:lastName')}
                  value={profile.last_name}
                  onChange={(value) => setProfile({ ...profile, last_name: value })}
                  required
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                />
              </div>
              <SettingsInput
                label={t('settings:email')}
                type="email"
                value={profile.email}
                onChange={(value) => setProfile({ ...profile, email: value })}
                required
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
              <SettingsInput
                label={t('settings:username')}
                value={profile.username}
                onChange={(value) => setProfile({ ...profile, username: value })}
                required
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                }
              />
            </form>
          </SettingsSection>
        )}

        {/* Section Sécurité */}
        {activeTab === 'security' && (
          <>
            <SettingsSection
              title={t('settings:changePassword')}
              description={t('settings:changePasswordDesc', { defaultValue: 'Modifiez votre mot de passe pour sécuriser votre compte' })}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              }
            >
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <SettingsInput
                  label={t('settings:oldPassword')}
                  type="password"
                  value={passwordForm.old_password}
                  onChange={(value) => setPasswordForm({ ...passwordForm, old_password: value })}
                  required
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  }
                />
                <div>
                  <SettingsInput
                    label={t('settings:newPassword')}
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(value) => setPasswordForm({ ...passwordForm, new_password: value })}
                    required
                    icon={
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    }
                  />
                  <PasswordStrengthMeter password={passwordForm.new_password} />
                </div>
                <SettingsInput
                  label={t('settings:confirmNewPassword')}
                  type="password"
                  value={passwordForm.new_password_confirm}
                  onChange={(value) => setPasswordForm({ ...passwordForm, new_password_confirm: value })}
                  required
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {t('settings:updatePassword')}
                </button>
              </form>
            </SettingsSection>

            <SettingsSection
              title={t('settings:activeSessions')}
              description={t('settings:activeSessionsDesc', { defaultValue: 'Gérez les appareils connectés à votre compte' })}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            >
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                    {t('settings:noActiveSessions')}
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {visibleSessions.map((session) => (
                        <SessionCard
                          key={session.jti}
                          session={session}
                          onRevoke={handleRevokeSession}
                          formatDate={formatDate}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
                      {sessions.length > 3 && (
                        <button
                          onClick={() => setShowAllSessions(!showAllSessions)}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {showAllSessions
                            ? t('settings:showLess', { defaultValue: 'Voir moins' })
                            : t('settings:showAll', { defaultValue: `Voir tout (${sessions.length})` })}
                        </button>
                      )}
                      {sessions.length > 1 && (
                        <button
                          onClick={handleRevokeAllSessions}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {t('settings:disconnectAllOther')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </SettingsSection>

            <SettingsSection
              title={t('settings:loginHistory')}
              description={t('settings:loginHistoryDesc', { defaultValue: 'Consultez l\'historique de vos connexions' })}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              {loginHistory.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings:noLoginHistory')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {t('settings:loginHistoryInfo')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {visibleHistory.map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatDate(entry.date)}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              entry.success
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}>
                              {entry.success ? t('settings:success') : t('settings:failed')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {entry.ip_address || t('common:na')} • {entry.user_agent || t('common:na')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {loginHistory.length > 3 && (
                    <button
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showAllHistory
                        ? t('settings:showLess', { defaultValue: 'Voir moins' })
                        : t('settings:showAll', { defaultValue: `Voir tout (${loginHistory.length})` })}
                    </button>
                  )}
                  {showAllHistory && loginHistory.length > historyPageSize && (
                    <div className="mt-4">
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
                    </div>
                  )}
                </>
              )}
            </SettingsSection>
          </>
        )}

        {/* Section Trading */}
        {activeTab === 'trading' && (
          <SettingsSection
            title={t('settings:tradingPreferences')}
            description={t('settings:tradingPreferencesDesc', { defaultValue: 'Configurez vos préférences de trading' })}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          >
            <div className="space-y-6 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings:dateFormat')}
                </label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings:numberFormat')}
                </label>
                <CustomSelect
                  value={preferences.number_format}
                  onChange={(value) => setPreferences({ ...preferences, number_format: value as 'point' | 'comma' })}
                  options={[
                    { value: 'comma', label: t('settings:numberFormatComma') },
                    { value: 'point', label: t('settings:numberFormatPoint') },
                  ]}
                />
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  {t('settings:notifications', { defaultValue: 'Notifications' })}
                </h4>
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t('settings:emailGoalAlerts', { defaultValue: 'Alertes email pour les objectifs' })}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('settings:emailGoalAlertsDescription', { defaultValue: 'Recevoir des emails quand un objectif est atteint ou en danger' })}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.email_goal_alerts !== false}
                    onChange={(e) => setPreferences({ ...preferences, email_goal_alerts: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 bg-white dark:bg-gray-700 cursor-pointer ml-3"
                  />
                </label>
              </div>
            </div>
          </SettingsSection>
        )}

        {/* Section Affichage */}
        {activeTab === 'display' && (
          <SettingsSection
            title={t('settings:displayPreferences')}
            description={t('settings:displayPreferencesDesc', { defaultValue: 'Personnalisez l\'apparence de l\'application' })}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          >
            <div className="space-y-6 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings:language')}
                </label>
                <CustomSelect
                  value={preferences.language}
                  onChange={(value) => setPreferences({ ...preferences, language: value as 'de' | 'en' | 'fr' | 'es' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' })}
                  options={[
                    { value: 'fr', label: 'Français' },
                    { value: 'en', label: 'English' },
                    { value: 'es', label: 'Español' },
                    { value: 'de', label: 'Deutsch' },
                    { value: 'it', label: 'Italiano' },
                    { value: 'pt', label: 'Português' },
                    { value: 'ja', label: '日本語' },
                    { value: 'zh', label: '中文' },
                    { value: 'ko', label: '한국어' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings:timezone')}
                </label>
                <CustomSelect
                  value={preferences.timezone}
                  onChange={(value) => setPreferences({ ...preferences, timezone: value as string })}
                  options={TIMEZONES.map(tz => ({ value: tz, label: tz }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('settings:theme')}
                </label>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {theme === 'light' ? t('settings:themeLight') : t('settings:themeDark')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleThemeToggle}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings:fontSize')}
                </label>
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
            </div>
          </SettingsSection>
        )}

        {/* Section Données */}
        {activeTab === 'data' && (
          <>
            <SettingsSection
              title={t('settings:dataExport')}
              description={t('settings:dataExportDescription')}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              }
            >
              <button
                onClick={handleExportData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('settings:exportMyData')}
              </button>
            </SettingsSection>

            <DangerZoneCard onDeleteAccount={handleDeleteAccount} />
          </>
        )}
      </div>

      <UnsavedChangesBar
        hasChanges={hasUnsavedChanges}
        onSave={handleSaveChanges}
        onDiscard={handleDiscardChanges}
        isSaving={loading}
      />
    </SettingsLayout>
  );
};

export default SettingsPage;
