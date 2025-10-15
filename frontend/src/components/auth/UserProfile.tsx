import React, { useState } from 'react';
import { User } from '../../services/auth';
import ChangePasswordForm from './ChangePasswordForm';

export {};

interface UserProfileProps {
  user: User;
  onClose: () => void;
  onPasswordChanged: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onClose, onPasswordChanged }) => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPasswordSuccess, setShowPasswordSuccess] = useState(false);

  const handlePasswordChangeSuccess = () => {
    setShowPasswordSuccess(true);
    setShowChangePassword(false);
    setTimeout(() => {
      setShowPasswordSuccess(false);
      onPasswordChanged();
    }, 2000);
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Mot de passe modifié !</h2>
          <p className="text-gray-600">
            Votre mot de passe a été modifié avec succès.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Profil utilisateur</h2>
        <p className="text-gray-600 mt-2">Informations de votre compte</p>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Informations personnelles</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-gray-500">Nom complet :</span>
              <p className="text-gray-900">{user.full_name}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Email :</span>
              <p className="text-gray-900">{user.email}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Nom d'utilisateur :</span>
              <p className="text-gray-900">{user.username}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Rôle :</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.is_admin 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {user.is_admin ? 'Administrateur' : 'Utilisateur'}
              </span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Statut :</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.is_verified 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {user.is_verified ? 'Vérifié' : 'En attente de vérification'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-3">Informations du compte</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-gray-500">Membre depuis :</span>
              <p className="text-gray-900">
                {new Date(user.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Dernière modification :</span>
              <p className="text-gray-900">
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

        <div className="flex space-x-3">
          <button
            onClick={() => setShowChangePassword(true)}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Changer le mot de passe
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
