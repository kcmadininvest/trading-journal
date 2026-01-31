import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DangerZoneCardProps {
  onDeleteAccount: () => Promise<void>;
}

export const DangerZoneCard: React.FC<DangerZoneCardProps> = ({ onDeleteAccount }) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'SUPPRIMER') {
      return;
    }

    if (!window.confirm(t('settings:deleteAccountWarning'))) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } catch (error) {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-red-50 dark:bg-red-900/10 rounded-lg border-2 border-red-200 dark:border-red-800 overflow-hidden">
        {/* En-tête avec icône d'avertissement */}
        <div className="px-6 py-4 bg-red-100 dark:bg-red-900/20 border-b-2 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-200 dark:bg-red-900/40 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900 dark:text-red-400">
                {t('settings:dangerZone')}
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {t('settings:dangerZoneDesc', { defaultValue: 'Actions irréversibles et définitives' })}
              </p>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-base font-semibold text-red-900 dark:text-red-400 mb-2">
                {t('settings:deleteAccount')}
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                {t('settings:deleteAccountWarning')}
              </p>
              <ul className="space-y-1.5 text-sm text-red-700 dark:text-red-300">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{t('settings:deleteAccountList1')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{t('settings:deleteAccountList2')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{t('settings:deleteAccountList3')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{t('settings:deleteAccountList4')}</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex-shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              {t('settings:deleteAccountButton')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmation */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('settings:confirmDeletion')}
                </h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings:deleteConfirmPrompt')}
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex gap-3 justify-end rounded-b-lg">
              <button
                onClick={() => {
                  setShowModal(false);
                  setConfirmText('');
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {t('common:cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'SUPPRIMER' || isDeleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {t('settings:confirmDeletion')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
