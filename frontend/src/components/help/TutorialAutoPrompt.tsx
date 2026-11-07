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
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onDismissAuto}
            className="mr-auto px-3 py-2 text-sm text-gray-600 dark:text-gray-300 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            {t('autoPrompt.dismissAuto')}
          </button>
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
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('autoPrompt.hint')}</p>
    </AccessibleDialog>
  );
};

export default TutorialAutoPrompt;
