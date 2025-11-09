import React, { useState, useEffect, useMemo } from 'react';
import { User, UserUpdateData } from '../../services/userService';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';

interface UserEditModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: number, data: UserUpdateData) => Promise<void>;
}

const UserEditModal: React.FC<UserEditModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useI18nTranslation();
  const [formData, setFormData] = useState<UserUpdateData>({
    first_name: '',
    last_name: '',
    username: '',
    role: 'user',
    is_verified: false,
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const roleOptions = useMemo(() => [
    { value: 'user', label: t('users:user') },
    { value: 'admin', label: t('users:admin') }
  ], [t]);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username || '',
        role: user.role,
        is_verified: user.is_verified,
        is_active: user.is_active,
      });
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    }));
    setError('');
  };

  const handleRoleChange = (value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      role: value as 'user' | 'admin'
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      await onSave(user.id, formData);
      onClose();
    } catch (err: any) {
      setError(err.message || t('users:editModal.error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4 border border-gray-100 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec gradient */}
        <div className="relative border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-t-2xl px-6 py-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 pr-10">
            {t('users:editModal.title')}
          </h2>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 z-20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
            type="button"
            aria-label="Fermer"
          >
            <svg className="w-6 h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* Informations utilisateur en lecture seule */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('users:editModal.email')}</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{user.email}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('users:editModal.id')}</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">#{user.id}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('users:editModal.firstName')}
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('users:editModal.lastName')}
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('users:editModal.username')}
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('users:editModal.role')}
              </label>
              <CustomSelect
                value={formData.role || 'user'}
                onChange={handleRoleChange}
                options={roleOptions}
              />
            </div>

            {/* Cases à cocher avec styles améliorés */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="h-5 w-5 mt-0.5 rounded appearance-none flex-shrink-0"
                />
                <label htmlFor="is_active" className="flex-1 text-sm text-gray-900 dark:text-gray-100 cursor-pointer select-none">
                  <span className="font-medium">{t('users:editModal.accountActive')}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formData.is_active ? t('users:active') : t('users:inactive')}
                  </p>
                </label>
              </div>
              <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <input
                  type="checkbox"
                  id="is_verified"
                  name="is_verified"
                  checked={formData.is_verified}
                  onChange={handleInputChange}
                  className="h-5 w-5 mt-0.5 rounded appearance-none flex-shrink-0"
                />
                <label htmlFor="is_verified" className="flex-1 text-sm text-gray-900 dark:text-gray-100 cursor-pointer select-none">
                  <span className="font-medium">{t('users:editModal.emailVerified')}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formData.is_verified ? t('users:verified') : t('users:notVerified')}
                  </p>
                </label>
              </div>
            </div>

            {/* Footer avec boutons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 font-medium text-sm"
              >
                {t('users:editModal.cancel')}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm shadow-sm hover:shadow-md"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('users:editModal.saving')}
                  </span>
                ) : (
                  t('users:editModal.save')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserEditModal;
