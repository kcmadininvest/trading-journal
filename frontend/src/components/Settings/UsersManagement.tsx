import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User as AuthUser } from '../../services/auth';
import { usersService, User as ApiUser, UserFilters } from '../../services/users';
import UserTable from './UserTable';
import UserDetailsModal from './UserDetailsModal';
import UserEditModal from './UserEditModal';
import UserDeleteModal from './UserDeleteModal';
import toast from 'react-hot-toast';

interface UsersManagementProps {
  currentUser: AuthUser;
  onUserUpdate?: (updatedUser: AuthUser) => void;
}

const UsersManagement: React.FC<UsersManagementProps> = ({ currentUser, onUserUpdate }) => {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({
    count: 0,
    next: null as string | null,
    previous: null as string | null
  });
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<ApiUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Vérifier les permissions
  const canViewUsers = currentUser?.is_admin;
  const canEditUsers = currentUser?.is_admin;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await usersService.getUsers(filters);
      setUsers(response.results);
      setPagination({
        count: response.count,
        next: response.next,
        previous: response.previous
      });
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (canViewUsers) {
      fetchUsers();
    }
  }, [canViewUsers, fetchUsers]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setFilters(prev => ({
      ...prev,
      search: value || undefined,
      page: 1
    }));
  };

  const handleFilterChange = (key: keyof UserFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({
      ...prev,
      page
    }));
  };

  const handleUserClick = (user: ApiUser) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleEditUser = (user: ApiUser) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleUserUpdated = (updatedUser: ApiUser, customMessage?: string) => {
    setUsers(prev => prev.map(user => 
      user.id === updatedUser.id ? updatedUser : user
    ));
    if (selectedUser?.id === updatedUser.id) {
      setSelectedUser(updatedUser);
    }
    
    // Si l'utilisateur modifié est l'utilisateur connecté, mettre à jour l'état global
    if (onUserUpdate && updatedUser.id === currentUser.id) {
      // Convertir ApiUser en AuthUser pour la sidebar
      const updatedCurrentUser: AuthUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        full_name: updatedUser.full_name,
        role: updatedUser.role,
        is_verified: updatedUser.is_verified,
        is_active: updatedUser.is_active,
        is_admin: updatedUser.role === 'admin',
        is_regular_user: updatedUser.role === 'user',
        created_at: updatedUser.created_at,
        updated_at: updatedUser.created_at // Utiliser created_at comme fallback
      };
      onUserUpdate(updatedCurrentUser);
    }
    
    toast.success(customMessage || 'Utilisateur mis à jour avec succès');
  };

  const handleToggleUserStatus = async (user: ApiUser) => {
    try {
      const updatedUser = await usersService.toggleUserStatus(user.id, !user.is_active);
      handleUserUpdated(updatedUser, `Utilisateur ${updatedUser.is_active ? 'activé' : 'désactivé'} avec succès`);
    } catch (error) {
      console.error('Erreur lors de la modification du statut:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la modification du statut');
    }
  };

  const handleChangeUserRole = async (user: ApiUser, newRole: 'user' | 'admin') => {
    try {
      // Mettre à jour immédiatement l'état local pour un feedback visuel instantané
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, role: newRole } : u
      ));
      
      const updatedUser = await usersService.changeUserRole(user.id, newRole);
      handleUserUpdated(updatedUser, `Rôle de l'utilisateur modifié avec succès`);
    } catch (error) {
      console.error('Erreur lors de la modification du rôle:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la modification du rôle');
      
      // En cas d'erreur, restaurer l'état précédent
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, role: user.role } : u
      ));
    }
  };

  const handleDeleteUser = (user: ApiUser) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (user: ApiUser) => {
    try {
      setDeleteLoading(true);
      await usersService.deleteUser(user.id);
      
      // Supprimer l'utilisateur de la liste locale
      setUsers(prev => prev.filter(u => u.id !== user.id));
      
      // Mettre à jour la pagination
      setPagination(prev => ({
        ...prev,
        count: prev.count - 1
      }));
      
      // Fermer le modal
      setShowDeleteModal(false);
      setDeletingUser(null);
      
      toast.success(`Utilisateur ${user.full_name} supprimé avec succès`);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la suppression de l\'utilisateur');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletingUser(null);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Filtre par recherche
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (
          user.full_name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.username.toLowerCase().includes(searchLower)
        );
        if (!matchesSearch) return false;
      }
      
      // Filtre par rôle
      if (filters.role && user.role !== filters.role) {
        return false;
      }
      
      // Filtre par statut actif
      if (filters.is_active !== undefined && user.is_active !== filters.is_active) {
        return false;
      }
      
      // Filtre par vérification
      if (filters.is_verified !== undefined && user.is_verified !== filters.is_verified) {
        return false;
      }
      
      return true;
    });
  }, [users, searchTerm, filters]);

  if (!canViewUsers) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Accès refusé</h3>
          <p className="text-gray-500">Seuls les administrateurs peuvent accéder à la gestion des utilisateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h2>
            <p className="text-gray-600 mt-1">Consultez et gérez les utilisateurs de l'application</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              {pagination.count} utilisateur{pagination.count > 1 ? 's' : ''}
            </div>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher par nom, email ou nom d'utilisateur..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filtre par rôle */}
          <div className="sm:w-48">
            <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Rôle
            </label>
            <select
              id="role-filter"
              value={filters.role || ''}
              onChange={(e) => handleFilterChange('role', e.target.value || undefined)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les rôles</option>
              <option value="user">Utilisateur</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          {/* Filtre par statut */}
          <div className="sm:w-48">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              id="status-filter"
              value={filters.is_active === undefined ? '' : filters.is_active.toString()}
              onChange={(e) => handleFilterChange('is_active', e.target.value === '' ? undefined : e.target.value === 'true')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau des utilisateurs */}
      <UserTable
        users={filteredUsers}
        loading={loading}
        onUserClick={handleUserClick}
        onEditUser={handleEditUser}
        onToggleStatus={handleToggleUserStatus}
        onChangeRole={handleChangeUserRole}
        onDeleteUser={handleDeleteUser}
        canEdit={canEditUsers}
      />

      {/* Pagination */}
      {pagination.count > (filters.limit || 20) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Affichage de {((filters.page || 1) - 1) * (filters.limit || 20) + 1} à{' '}
              {Math.min((filters.page || 1) * (filters.limit || 20), pagination.count)} sur{' '}
              {pagination.count} utilisateurs
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange((filters.page || 1) - 1)}
                disabled={!pagination.previous || loading}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <span className="px-3 py-2 text-sm text-gray-700">
                Page {filters.page || 1}
              </span>
              <button
                onClick={() => handlePageChange((filters.page || 1) + 1)}
                disabled={!pagination.next || loading}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
          onEdit={() => {
            setShowUserModal(false);
            handleEditUser(selectedUser);
          }}
          canEdit={canEditUsers}
        />
      )}

      {editingUser && (
        <UserEditModal
          user={editingUser}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingUser(null);
          }}
          onSave={handleUserUpdated}
        />
      )}

      {deletingUser && (
        <UserDeleteModal
          user={deletingUser}
          isOpen={showDeleteModal}
          onClose={handleCloseDeleteModal}
          onConfirm={handleConfirmDelete}
          loading={deleteLoading}
        />
      )}
    </div>
  );
};

export default UsersManagement;