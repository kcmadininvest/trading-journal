import React from 'react';
import { useTranslation } from 'react-i18next';

interface UnsavedChangesBarProps {
  hasChanges: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
}

export const UnsavedChangesBar: React.FC<UnsavedChangesBarProps> = ({
  hasChanges,
  onSave,
  onDiscard,
  isSaving = false,
}) => {
  const { t } = useTranslation();

  if (!hasChanges) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:bottom-6 lg:left-1/2 lg:transform lg:-translate-x-1/2 lg:max-w-2xl z-50 lg:px-4">
      <div className="bg-blue-600 dark:bg-blue-500 text-white shadow-lg lg:rounded-lg border-t lg:border border-blue-700 dark:border-blue-600">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium">
                  {t('settings:unsavedChanges', { defaultValue: 'Modifications non sauvegardées' })}
                </p>
                <p className="text-xs opacity-90 hidden sm:block">
                  {t('settings:unsavedChangesDesc', { defaultValue: 'Vous avez des modifications qui n\'ont pas été sauvegardées' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onDiscard}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50"
              >
                {t('common:cancel', { defaultValue: 'Annuler' })}
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-sm font-medium bg-white text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {t('settings:saveChanges', { defaultValue: 'Enregistrer' })}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
