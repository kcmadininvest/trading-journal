import React from 'react';
import { useTranslation } from 'react-i18next';
import { replayPanelClass, replayPrimaryButtonClass } from './replayStyles';

interface JournalDraftPanelProps {
  content: string;
  applied: boolean;
  loading?: boolean;
  onApply: () => void;
}

export const JournalDraftPanel: React.FC<JournalDraftPanelProps> = ({
  content,
  applied,
  loading,
  onApply,
}) => {
  const { t } = useTranslation('replay');

  return (
    <div className={`${replayPanelClass} h-full flex flex-col`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {t('journalDraftTitle')}
        </h3>
        <button
          type="button"
          onClick={onApply}
          disabled={loading || !content || applied}
          className={`${replayPrimaryButtonClass} !h-8 text-xs px-2.5`}
        >
          {applied ? t('journalApplied') : t('applyJournal')}
        </button>
      </div>
      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-y-auto flex-1 max-h-48 font-sans bg-gray-50 dark:bg-gray-900/30 rounded-md p-3 border border-gray-100 dark:border-gray-700">
        {content || t('noDraft')}
      </pre>
    </div>
  );
};
