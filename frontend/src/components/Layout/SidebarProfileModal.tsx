import React, { useState } from 'react';
import { User } from '../../services/auth';
import ChangePasswordForm from '../auth/ChangePasswordForm';

export {};

interface SidebarProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onPasswordChanged: () => void;
}

const SidebarProfileModal: React.FC<SidebarProfileModalProps> = ({ 
  user, 
  isOpen, 
  onClose, 
  onPasswordChanged 
}) => {
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

  if (!isOpen) return null;

  if (showChangePassword) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="relative w-full max-w-md">
          <button
            onClick={() => setShowChangePassword(false)}
            className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <ChangePasswordForm
            onSuccess={handlePasswordChangeSuccess}
            onCancel={() => setShowChangePassword(false)}
          />
        </div>
      </div>
    );
  }

  if (showPasswordSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-auto">
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
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-xl w-full mx-auto">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
            <span className="text-white font-semibold text-xl">
              {user.first_name.charAt(0).toUpperCase()}
            </span>
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
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Changer le mot de passe
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarProfileModal;
