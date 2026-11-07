import React from 'react';
import { useTranslation } from 'react-i18next';
import AccessibleDialog from '../ui/AccessibleDialog';

export interface TutorialAutoPromptProps {
  isOpen: boolean;
  onStart: () => void;
  onLater: () => void;
  onDismissAuto: () => void;
}

/**
 * Prompt first-login : ouvre le même contenu P0 (#help/getting-started).
 * « Ne plus proposer auto » ne coupe que le rappel, jamais l’accès Aide.
 */
const TutorialAutoPrompt: React.FC<TutorialAutoPromptProps> = ({
  isOpen,
  onStart,
  onLater,
  onDismissAuto,
}) => {
  const { t } = useTranslation('help');

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onLater}
      title={t('autoPrompt.title')}
      description={t('autoPrompt.description')}
      size="xl"
      footerClassName="px-6 pb-6 border-t border-gray-100 dark:border-gray-700 pt-4"
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onLater}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('autoPrompt.later')}
            </button>
            <button
              type="button"
              onClick={onStart}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('autoPrompt.start')}
            </button>
          </div>
          <button
            type="button"
            onClick={onDismissAuto}
            className="self-start text-left text-sm text-gray-600 dark:text-gray-300 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-1"
          >
            {t('autoPrompt.dismissAuto')}
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('autoPrompt.hint')}</p>
    </AccessibleDialog>
  );
};

export default TutorialAutoPrompt;
