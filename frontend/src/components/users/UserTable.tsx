import React from 'react';
import { User } from '../../services/userService';
import { Tooltip } from '../ui';
import { usePreferences } from '../../hooks/usePreferences';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface UserTableProps {
  users: User[];
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
  onToggleUserStatus: (user: User) => void;
  selectedUsers: number[];
  onSelectUser: (userId: number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

const UserTable: React.FC<UserTableProps> = ({
  users,
  onEditUser,
  onDeleteUser,
  onToggleUserStatus,
  selectedUsers,
  onSelectUser,
  onSelectAll,
}) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const allSelected = users.length > 0 && selectedUsers.length === users.length;
  const someSelected = selectedUsers.length > 0 && selectedUsers.length < users.length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: preferences.timezone,
    });
  };

  const getRoleBadge = (role: string) => {
    return role === 'admin' 
      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' 
      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
      {/* Mobile Card View */}
      <div className="block md:hidden">
        <div className="p-3 space-y-3">
          {users.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('users:page.noUsers')}
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <label className="flex items-center cursor-pointer p-1 -m-1">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => onSelectUser(user.id, e.target.checked)}
                        className="h-5 w-5 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400 flex-shrink-0 cursor-pointer"
                      />
                    </label>
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {user.first_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.email}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                  <div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('users:role')}</div>
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getRoleBadge(user.role)}`}>
                      {user.role === 'admin' ? t('users:admin') : t('users:user')}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('users:accountStatus')}</div>
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusBadge(user.is_active)}`}>
                      {user.is_active ? t('users:active') : t('users:inactive')}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('users:emailStatus')}</div>
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      user.is_verified 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                    }`}>
                      {user.is_verified ? t('users:verified') : t('users:notVerified')}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('users:createdAt')}</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 break-words">{formatDate(user.created_at)}</div>
                  </div>
                </div>
                
                {user.last_login && (
                  <div className="mb-3">
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{t('users:lastLogin')}</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 break-words">{formatDate(user.last_login)}</div>
                  </div>
                )}
                
                <div className="pt-3 border-t border-gray-200 dark:border-gray-600 flex flex-row gap-2">
                  <button
                    onClick={() => onEditUser(user)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    title={t('users:editUser')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t('users:editUser')}
                  </button>
                  <button
                    onClick={() => onToggleUserStatus(user)}
                    className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      user.is_active 
                        ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/50' 
                        : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50'
                    }`}
                    title={user.is_active ? t('users:disableAccount') : t('users:enableAccount')}
                  >
                    {user.is_active ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {user.is_active ? t('users:disableAccount') : t('users:enableAccount')}
                  </button>
                  <button
                    onClick={() => onDeleteUser(user)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    title={t('users:deleteUser')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {t('users:deleteUser')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto overflow-y-clip">
        <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left" style={{width: '3%'}}>
                <label className="flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="h-5 w-5 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400 cursor-pointer"
                  />
                </label>
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{width: '5%'}}>
                {t('users:id')}
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{width: '25%'}}>
                {t('users:user')}
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{width: '8%'}}>
                {t('users:role')}
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{width: '10%'}}>
                {t('users:accountStatus')}
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{width: '10%'}}>
                {t('users:emailStatus')}
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{width: '13%'}}>
                {t('users:createdAt')}
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{width: '13%'}}>
                {t('users:lastLogin')}
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{width: '13%'}}>
                {t('common:actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 sm:px-6 py-8 sm:py-10 text-center">
                  <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400">{t('users:page.noUsers')}</div>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap" style={{width: '3%'}}>
                    <label className="flex items-center justify-center cursor-pointer p-2 -m-2">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => onSelectUser(user.id, e.target.checked)}
                        className="h-5 w-5 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400 cursor-pointer"
                      />
                    </label>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-mono" style={{width: '5%'}}>
                    {user.id}
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4" style={{width: '25%'}}>
                    <div className="flex items-center min-w-0">
                      <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                            {user.first_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-2 sm:ml-4 min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : user.email}
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap" style={{width: '8%'}}>
                    <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getRoleBadge(user.role)}`}>
                      {user.role === 'admin' ? t('users:admin') : t('users:user')}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap" style={{width: '10%'}}>
                    <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getStatusBadge(user.is_active)}`}>
                      {user.is_active ? t('users:active') : t('users:inactive')}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap" style={{width: '10%'}}>
                    <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${
                      user.is_verified 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                    }`}>
                      {user.is_verified ? t('users:verified') : t('users:notVerified')}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-[10px] sm:text-xs text-gray-500 dark:text-gray-400" style={{width: '13%'}}>
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-[10px] sm:text-xs text-gray-500 dark:text-gray-400" style={{width: '13%'}}>
                    {user.last_login ? formatDate(user.last_login) : t('users:never')}
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-sm font-medium" style={{width: '13%'}}>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      {/* Bouton Modifier */}
                      <Tooltip content={t('users:editUser')} position="top">
                        <button
                          onClick={() => onEditUser(user)}
                          className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>

                      {/* Bouton Activer/Désactiver */}
                      <Tooltip 
                        content={user.is_active ? t('users:disableAccount') : t('users:enableAccount')} 
                        position="top"
                      >
                        <button
                          onClick={() => onToggleUserStatus(user)}
                          className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
                            user.is_active 
                              ? 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 focus:ring-yellow-500' 
                              : 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 focus:ring-green-500'
                          }`}
                        >
                          {user.is_active ? (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      </Tooltip>

                      {/* Bouton Supprimer */}
                      <Tooltip content={t('users:deleteUser')} position="top">
                        <button
                          onClick={() => onDeleteUser(user)}
                          className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserTable;
