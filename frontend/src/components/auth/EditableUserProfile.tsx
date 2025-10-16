import React, { useState, useEffect } from 'react';
import { User } from '../../services/auth';
import ChangePasswordForm from './ChangePasswordForm';
import authService from '../../services/auth';

interface EditableUserProfileProps {
  user: User;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
  onPasswordChanged: () => void;
}

const EditableUserProfile: React.FC<EditableUserProfileProps> = ({ 
  user, 
  onClose, 
  onUserUpdated,
  onPasswordChanged 
}) => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPasswordSuccess, setShowPasswordSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // État des champs modifiables
  const [formData, setFormData] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    role: user.role || 'user',
    is_verified: user.is_verified || false,
    is_active: user.is_active !== undefined ? user.is_active : true
  });

  // Vérifier si l'utilisateur actuel est admin
  const currentUser = authService.getCurrentUser();
  const isCurrentUserAdmin = currentUser?.is_admin || false;

  const handlePasswordChangeSuccess = () => {
    setShowPasswordSuccess(true);
    setShowChangePassword(false);
    setTimeout(() => {
      setShowPasswordSuccess(false);
      onPasswordChanged();
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedUser = await authService.updateProfile(formData);
      onUserUpdated(updatedUser);
      setIsEditing(false);
      setSuccess('Profil mis à jour avec succès !');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      role: user.role || 'user',
      is_verified: user.is_verified || false,
      is_active: user.is_active !== undefined ? user.is_active : true
    });
    setIsEditing(false);
    setError(null);
    setSuccess(null);
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setError(null);

    try {
      await authService.deleteAccount();
      // Rediriger vers la page de connexion ou fermer l'application
      authService.logout();
      window.location.href = '/';
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la suppression du compte');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (showChangePassword) {
    return (
      <ChangePasswordForm
        onSuccess={handlePasswordChangeSuccess}
        onCancel={() => setShowChangePassword(false)}
      />
    );
  }

  if (showPasswordSuccess) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Mot de passe modifié !</h3>
          <p className="text-gray-600">Votre mot de passe a été mis à jour avec succès.</p>
        </div>
      </div>
    );
  }

  if (showDeleteConfirm) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header fixe */}
        <div className="bg-red-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Suppression du compte</h2>
                <p className="text-red-100 text-sm">Cette action est irréversible</p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="p-2 bg-red-500 hover:bg-red-400 rounded-lg transition-colors"
              title="Annuler"
            >
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenu de confirmation */}
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Attention !</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>Vous êtes sur le point de supprimer définitivement votre compte et toutes les données associées :</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Vos informations personnelles</li>
                    <li>Tous vos trades et données de trading</li>
                    <li>Vos statistiques et analyses</li>
                    <li>Votre historique complet</li>
                  </ul>
                  <p className="mt-2 font-medium">Cette action est irréversible et ne peut pas être annulée.</p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
              className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {deleteLoading ? 'Suppression...' : 'Oui, supprimer mon compte'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header fixe */}
      <div className="bg-gray-800 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {user.first_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold">Profil utilisateur</h2>
              <p className="text-gray-300 text-sm">
                {isEditing ? 'Modifiez vos informations' : 'Informations de votre compte'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                Modifier
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Fermer"
            >
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
            </div>
          )}

          <div className="space-y-4">
            {/* Informations personnelles */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="mb-3">
                <h3 className="font-medium text-gray-900">Informations personnelles</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{user.first_name || 'Non renseigné'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{user.last_name || 'Non renseigné'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom d'utilisateur
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900 py-2">{user.username}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <p className="text-gray-900 py-2">{user.email}</p>
                  <p className="text-xs text-gray-500">L'email ne peut pas être modifié</p>
                </div>
              </div>
            </div>

            {/* Informations du compte - Modifiables par admin seulement */}
            {isCurrentUserAdmin && (
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="font-medium text-gray-900 mb-3">Gestion du compte (Admin)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rôle
                    </label>
                    {isEditing ? (
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_admin 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.is_admin ? 'Administrateur' : 'Utilisateur'}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Statut de vérification
                    </label>
                    {isEditing ? (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="is_verified"
                          checked={formData.is_verified}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Email vérifié
                        </span>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_verified 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.is_verified ? 'Vérifié' : 'En attente de vérification'}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Statut du compte
                    </label>
                    {isEditing ? (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Compte actif
                        </span>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section de suppression du compte */}
            <div className="bg-gray-50 rounded-lg p-5">
              <h3 className="font-medium text-gray-900 mb-3">Suppression du compte</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Supprimer définitivement votre compte et toutes les données associées.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                >
                  Supprimer le compte
                </button>
              </div>
            </div>

            {/* Informations du compte */}
            <div className="bg-gray-50 rounded-lg p-5">
              <h3 className="font-medium text-gray-900 mb-3">Informations du compte</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Membre depuis
                  </label>
                  <p className="text-gray-900 py-2">
                    {new Date(user.created_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dernière modification
                  </label>
                  <p className="text-gray-900 py-2">
                    {new Date(user.updated_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Boutons d'action */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Changer le mot de passe
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Fermer
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditableUserProfile;