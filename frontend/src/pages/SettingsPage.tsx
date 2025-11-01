import React, { useState, useEffect } from 'react';
import userService, { UserPreferences, ActiveSession, LoginHistoryEntry, PasswordChangeData } from '../services/userService';
import authService from '../services/auth';

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
      showMessage('error', error.message || 'Erreur lors du chargement des données');
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
      showMessage('success', result.message || 'Profil mis à jour avec succès');
      
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
      showMessage('error', 'Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await userService.changePassword(passwordForm as PasswordChangeData);
      showMessage('success', 'Mot de passe modifié avec succès');
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
      showMessage('success', 'Préférences mises à jour avec succès');
      // Appliquer le thème immédiatement si changé
      if (preferences.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
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

  const handleRevokeSession = async (jti: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir déconnecter cette session ?')) return;
    setLoading(true);
    try {
      await userService.revokeSession(jti);
      showMessage('success', 'Session déconnectée avec succès');
      await loadSecurityData();
    } catch (error: any) {
      showMessage('error', error.message || 'Erreur lors de la déconnexion de la session');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir déconnecter toutes les autres sessions ?')) return;
    setLoading(true);
    try {
      await userService.revokeAllOtherSessions();
      showMessage('success', 'Toutes les autres sessions ont été déconnectées');
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
      showMessage('success', 'Données exportées avec succès');
    } catch (error: any) {
      showMessage('error', error.message || 'Erreur lors de l\'export des données');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') {
      showMessage('error', 'Veuillez taper "SUPPRIMER" pour confirmer');
      return;
    }
    if (!window.confirm('Êtes-vous ABSOLUMENT sûr ? Cette action est irréversible et supprimera toutes vos données.')) return;
    
    setLoading(true);
    try {
      await userService.deleteCurrentUserAccount();
      showMessage('success', 'Compte supprimé avec succès');
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
    });
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profil', icon: '👤' },
    { id: 'security' as const, label: 'Sécurité', icon: '🔒' },
    { id: 'trading' as const, label: 'Trading', icon: '📊' },
    { id: 'display' as const, label: 'Affichage', icon: '🎨' },
    { id: 'data' as const, label: 'Données', icon: '💾' },
  ];

  return (
    <div className="h-full flex flex-col -my-6">
      {message && (
        <div className={`m-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200 px-4 sm:px-6 lg:px-8 bg-white">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex-shrink-0`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="flex-1 overflow-y-auto bg-white p-4 sm:p-6 lg:p-8">
        {loading && (
          <div className="mb-4 text-gray-600">Chargement...</div>
        )}

        {/* Profil */}
        {activeTab === 'profile' && (
          <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Informations du profil</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                    <input
                      type="text"
                      value={profile.first_name}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                    <input
                      type="text"
                      value={profile.last_name}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom d'utilisateur</label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Enregistrer les modifications
                </button>
              </form>
          </div>
        )}

        {/* Sécurité */}
        {activeTab === 'security' && (
          <div className="space-y-8">
              {/* Changement de mot de passe */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Changer le mot de passe</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ancien mot de passe</label>
                    <input
                      type="password"
                      value={passwordForm.old_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      value={passwordForm.new_password_confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Changer le mot de passe
                  </button>
                </form>
              </div>

              {/* Sessions actives */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setSessionsExpanded(!sessionsExpanded)}
                    className="flex items-center text-xl font-semibold text-gray-900 hover:text-gray-700"
                  >
                    <svg
                      className={`w-5 h-5 mr-2 transition-transform ${sessionsExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Sessions actives
                    <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                      {sessions.length}
                    </span>
                  </button>
                  {sessionsExpanded && sessions.length > 1 && (
                    <button
                      onClick={handleRevokeAllSessions}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Déconnecter toutes les autres sessions
                    </button>
                  )}
                </div>
                {sessionsExpanded && (
                  <div className="space-y-3">
                    {sessions.length === 0 ? (
                      <p className="text-gray-500 py-4">Aucune session active</p>
                    ) : (
                      sessions.map((session) => (
                        <div
                          key={session.jti}
                          className={`p-4 border rounded-md ${
                            session.is_current ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-900">
                                {session.device_info || 'Appareil inconnu'}
                                {session.is_current && (
                                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Session actuelle</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                Créée le {formatDate(session.created_at)}
                              </div>
                              <div className="text-sm text-gray-600">
                                Expire le {formatDate(session.expires_at)}
                              </div>
                            </div>
                            {!session.is_current && (
                              <button
                                onClick={() => handleRevokeSession(session.jti)}
                                className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                              >
                                Déconnecter
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
                  className="flex items-center text-xl font-semibold text-gray-900 hover:text-gray-700 mb-4"
                >
                  <svg
                    className={`w-5 h-5 mr-2 transition-transform ${historyExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Historique des connexions
                  <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                    {loginHistory.length}
                  </span>
                </button>
                {historyExpanded && (
                  <>
                    {loginHistory.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-gray-500">Aucun historique de connexion disponible.</p>
                        <p className="text-sm text-gray-400 mt-2">L'historique sera enregistré lors de vos prochaines connexions.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Appareil</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {loginHistory.map((entry, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(entry.date)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{entry.ip_address || 'N/A'}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={entry.user_agent || 'N/A'}>{entry.user_agent || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    entry.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {entry.success ? 'Réussie' : 'Échouée'}
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
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Préférences de trading</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format de date</label>
                  <select
                    value={preferences.date_format}
                    onChange={(e) => setPreferences({ ...preferences, date_format: e.target.value as 'US' | 'EU' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EU">EU (DD/MM/YYYY)</option>
                    <option value="US">US (MM/DD/YYYY)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format des nombres</label>
                  <select
                    value={preferences.number_format}
                    onChange={(e) => setPreferences({ ...preferences, number_format: e.target.value as 'point' | 'comma' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="comma">Virgule (1 234,56)</option>
                    <option value="point">Point (1.234,56)</option>
                  </select>
                </div>
                <button
                  onClick={handlePreferencesUpdate}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Enregistrer les préférences
                </button>
              </div>
          </div>
        )}

        {/* Préférences d'affichage */}
        {activeTab === 'display' && (
          <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Préférences d'affichage</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Langue</label>
                  <select
                    value={preferences.language}
                    onChange={(e) => setPreferences({ ...preferences, language: e.target.value as 'fr' | 'en' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fuseau horaire</label>
                  <select
                    value={preferences.timezone}
                    onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Thème</label>
                  <select
                    value={preferences.theme}
                    onChange={(e) => setPreferences({ ...preferences, theme: e.target.value as 'light' | 'dark' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="light">Clair</option>
                    <option value="dark">Sombre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Taille de police</label>
                  <select
                    value={preferences.font_size}
                    onChange={(e) => setPreferences({ ...preferences, font_size: e.target.value as 'small' | 'medium' | 'large' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="small">Petit</option>
                    <option value="medium">Moyen</option>
                    <option value="large">Grand</option>
                  </select>
                </div>
                <button
                  onClick={handlePreferencesUpdate}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Enregistrer les préférences
                </button>
              </div>
          </div>
        )}

        {/* Données et confidentialité */}
        {activeTab === 'data' && (
          <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Export des données</h2>
                <p className="text-gray-600 mb-4">
                  Téléchargez une copie de toutes vos données au format JSON. Cela inclut votre profil, préférences, comptes de trading, trades, stratégies et historique des connexions.
                </p>
                <button
                  onClick={handleExportData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Exporter mes données
                </button>
              </div>

              <div className="border-t border-gray-200 pt-8">
                <h2 className="text-xl font-semibold text-red-900 mb-6">Zone de danger</h2>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Supprimer mon compte</h3>
                  <p className="text-red-700 mb-4">
                    Cette action est irréversible. Toutes vos données seront définitivement supprimées, y compris :
                  </p>
                  <ul className="list-disc list-inside text-red-700 mb-4 space-y-1">
                    <li>Votre profil et préférences</li>
                    <li>Tous vos trades et comptes de trading</li>
                    <li>Toutes vos stratégies</li>
                    <li>Votre historique de connexions</li>
        </ul>
                  {!showDeleteModal ? (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Supprimer mon compte
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-red-900 mb-2">
                          Tapez "SUPPRIMER" pour confirmer
                        </label>
                        <input
                          type="text"
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="SUPPRIMER"
                        />
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={loading || deleteConfirm !== 'SUPPRIMER'}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirmer la suppression
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteModal(false);
                            setDeleteConfirm('');
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                        >
                          Annuler
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
