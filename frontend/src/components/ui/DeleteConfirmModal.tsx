import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  message?: string | React.ReactNode;
  itemName?: string;
  isLoading?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  isLoading = false,
  confirmButtonText,
  cancelButtonText,
}) => {
  const { t } = useI18nTranslation();

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      // L'erreur sera gérée par le composant parent
    }
  };

  const defaultTitle = title || t('common:deleteConfirm', { defaultValue: 'Are you sure?' });
  const defaultMessage = message || (
    <p className="text-gray-600 dark:text-gray-400">
      {itemName 
        ? t('common:deleteItemConfirm', { item: itemName, defaultValue: `Are you sure you want to delete ${itemName}? This action cannot be undone.` })
        : t('common:deleteConfirmGeneric', { defaultValue: 'This action cannot be undone.' })
      }
    </p>
  );
  const defaultConfirmText = confirmButtonText || t('common:delete', { defaultValue: 'Delete' });
  const defaultCancelText = cancelButtonText || t('common:cancel', { defaultValue: 'Cancel' });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4 border border-gray-100 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec gradient rouge */}
        <div className="relative border-b border-red-100 dark:border-red-900/50 bg-gradient-to-r from-red-50 to-rose-50 dark:from-gray-800 dark:to-gray-700 rounded-t-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 pr-10">
              {defaultTitle}
            </h2>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute top-4 right-3 z-20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-2 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 cursor-pointer"
              type="button"
              aria-label="Fermer"
            >
              <svg className="w-6 h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Message */}
          <div className="mb-6">
            {typeof defaultMessage === 'string' ? (
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">
                {defaultMessage}
              </p>
            ) : (
              defaultMessage
            )}
          </div>

          {/* Footer avec boutons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {defaultCancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm shadow-sm hover:shadow-md"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('common:deleting', { defaultValue: 'Deleting...' })}
                </span>
              ) : (
                defaultConfirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;

