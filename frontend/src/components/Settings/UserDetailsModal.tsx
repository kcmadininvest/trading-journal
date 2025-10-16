import React from 'react';
import { User } from '../../services/users';

interface UserDetailsModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  isOpen,
  onClose,
  onEdit,
  canEdit
}) => {
  if (!isOpen) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadge = (role: string) => {
    const isAdmin = role === 'admin';
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
        isAdmin 
          ? 'bg-purple-100 text-purple-800' 
          : 'bg-gray-100 text-gray-800'
      }`}>
        {isAdmin ? 'Administrateur' : 'Utilisateur'}
      </span>
    );
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
        isActive 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {isActive ? 'Actif' : 'Inactif'}
      </span>
    );
  };

  const getVerificationBadge = (isVerified: boolean) => {
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
        isVerified 
          ? 'bg-blue-100 text-blue-800' 
          : 'bg-yellow-100 text-yellow-800'
      }`}>
        {isVerified ? 'Email vérifié' : 'Email non vérifié'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-lg font-medium text-gray-700">
                {user.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.full_name}</h2>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-6">
          {/* Informations de base */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de base</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur</label>
                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{user.username}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{user.first_name || 'Non renseigné'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de famille</label>
                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{user.last_name || 'Non renseigné'}</p>
              </div>
            </div>
          </div>

          {/* Statuts et rôles */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statuts et rôles</h3>
            <div className="flex flex-wrap gap-3">
              {getRoleBadge(user.role)}
              {getStatusBadge(user.is_active)}
              {getVerificationBadge(user.is_verified)}
            </div>
          </div>

          {/* Statistiques */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiques</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de trades</label>
                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{user.trades_count}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID utilisateur</label>
                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">#{user.id}</p>
              </div>
            </div>
          </div>

          {/* Dates importantes */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dates importantes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de création</label>
                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{formatDate(user.created_at)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dernière connexion</label>
                <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{formatDate(user.last_login)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
          {canEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors"
            >
              Modifier l'utilisateur
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;

