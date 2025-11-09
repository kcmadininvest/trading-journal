import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { User, userService, UserUpdateData } from '../services/userService';
import { UserTable, UserEditModal, BulkActions } from '../components/users';
import { PaginationControls, DeleteConfirmModal } from '../components/ui';
import { usePagination } from '../hooks';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../components/common/CustomSelect';

const UserManagementPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const roleFilterOptions = useMemo(() => [
    { value: 'all', label: t('users:page.allRoles') },
    { value: 'user', label: t('users:user') },
    { value: 'admin', label: t('users:admin') }
  ], [t]);

  const statusFilterOptions = useMemo(() => [
    { value: 'all', label: t('users:page.allStatuses') },
    { value: 'active', label: t('users:active') },
    { value: 'inactive', label: t('users:inactive') }
  ], [t]);

  // Charger les utilisateurs
  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await userService.getAllUsers();
      
      // getAllUsers retourne directement un tableau d'utilisateurs
      if (Array.isArray(usersData)) {
        setUsers(usersData);
      } else {
        console.error('Invalid users data format:', usersData);
        setUsers([]);
        toast.error(t('users:page.error.invalidDataFormat'));
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error(error.message || t('users:page.error.loading'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtrer les utilisateurs
  const filteredUsers = Array.isArray(users) ? users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) : false) ||
                          user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && user.is_active) ||
                          (statusFilter === 'inactive' && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  }) : [];

  // Utiliser la pagination
  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedUsers,
    totalItems,
    goToPage,
    startIndex,
    endIndex,
  } = usePagination(filteredUsers, {
    itemsPerPage,
    initialPage: 1,
  });

  // Gestion de la sélection
  const handleSelectUser = (userId: number, selected: boolean) => {
    if (selected) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedUsers((prev) => [...prev, ...paginatedUsers.map((user) => user.id)]);
    } else {
      setSelectedUsers((prev) => prev.filter((id) => !paginatedUsers.map((user) => user.id).includes(id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedUsers([]);
  };

  // Actions sur les utilisateurs
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleSaveUser = async (userId: number, data: UserUpdateData) => {
    try {
      const updatedUser = await userService.updateUser(userId, data);
      
      // Mettre à jour l'utilisateur dans la liste locale au lieu de recharger
      setUsers(prevUsers => 
        prevUsers.map(u => u.id === userId ? { ...u, ...updatedUser } : u)
      );
      
      toast.success(t('users:page.success.userUpdated'));
    } catch (error: any) {
      throw error; // L'erreur sera gérée par le modal
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      const updatedUser = await userService.updateUser(user.id, { is_active: !user.is_active });
      
      // Mettre à jour l'utilisateur dans la liste locale au lieu de recharger
      setUsers(prevUsers => 
        prevUsers.map(u => u.id === user.id ? { ...u, is_active: updatedUser.is_active } : u)
      );
      
      toast.success(user.is_active ? t('users:page.success.userDisabled') : t('users:page.success.userEnabled'));
    } catch (error: any) {
      toast.error(error.message || t('users:page.error.updateStatus'));
    }
  };

  const handleDeleteUser = async (user: User) => {
    setDeleteUser(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUser) return;
    
    setDeleteLoading(true);
    try {
      await userService.deleteUser(deleteUser.id);
      
      // Supprimer l'utilisateur de la liste locale au lieu de recharger
      setUsers(prevUsers => prevUsers.filter(u => u.id !== deleteUser.id));
      
      toast.success(t('users:page.success.userDeleted'));
      setShowDeleteModal(false);
      setDeleteUser(null);
    } catch (error: any) {
      toast.error(error.message || t('users:page.error.delete'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      const result = await userService.bulkDeleteUsers(selectedUsers);
      
      // Extraire les IDs des utilisateurs supprimés depuis results
      const deletedIds = result.results?.map((item: any) => item.user_id) || [];
      
      // Supprimer les utilisateurs supprimés de la liste locale
      setUsers(prevUsers => 
        prevUsers.filter(u => !deletedIds.includes(u.id))
      );
      
      setSelectedUsers([]);
      toast.success(t('users:page.success.usersDeleted', { count: deletedIds.length }));
      setShowBulkDeleteModal(false);
    } catch (error: any) {
      toast.error(error.message || t('users:page.error.bulkDelete'));
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('users:page.loading')}</p>
        </div>
      </div>
    );
  }

  return (
        <div className="bg-gray-50 dark:bg-gray-900 py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('users:page.totalUsers')}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('users:page.administrators')}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('users:page.activeAccounts')}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {users.filter(u => u.is_active).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres et recherche */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('users:page.search')}
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('users:page.searchPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('users:role')}
              </label>
              <CustomSelect
                value={roleFilter}
                onChange={(value) => setRoleFilter(value as 'all' | 'user' | 'admin')}
                options={roleFilterOptions}
              />
            </div>
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('users:accountStatus')}
              </label>
              <CustomSelect
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}
                options={statusFilterOptions}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadUsers}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('users:page.refreshing')}
                  </>
                ) : (
                  t('users:page.refresh')
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Actions en masse */}
        <BulkActions
          selectedCount={selectedUsers.length}
          onBulkDelete={handleBulkDelete}
          onClearSelection={handleClearSelection}
        />

            {/* Tableau des utilisateurs */}
            <UserTable
              users={paginatedUsers}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              onToggleUserStatus={handleToggleUserStatus}
              selectedUsers={selectedUsers}
              onSelectUser={handleSelectUser}
              onSelectAll={handleSelectAll}
            />

            {/* Contrôles de pagination */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={goToPage}
              onPageSizeChange={setItemsPerPage}
              pageSizeOptions={[5, 10, 25, 50]}
            />

        {/* Modal de modification */}
        <UserEditModal
          user={editingUser}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingUser(null);
          }}
          onSave={handleSaveUser}
        />

        {/* Modal de suppression d'un utilisateur */}
        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteUser(null);
          }}
          onConfirm={confirmDeleteUser}
          title={t('users:page.confirm.deleteUserTitle', { defaultValue: 'Delete User' })}
          message={deleteUser ? t('users:page.confirm.deleteUser', { email: deleteUser.email }) : ''}
          isLoading={deleteLoading}
          confirmButtonText={t('users:delete', { defaultValue: 'Delete' })}
        />

        {/* Modal de suppression en masse */}
        <DeleteConfirmModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={confirmBulkDelete}
          title={t('users:page.confirm.bulkDeleteTitle', { defaultValue: 'Delete Multiple Users' })}
          message={t('users:page.confirm.bulkDelete', { count: selectedUsers.length })}
          isLoading={bulkDeleteLoading}
          confirmButtonText={t('users:delete', { defaultValue: 'Delete' })}
        />
      </div>
    </div>
  );
};

export default UserManagementPage;
