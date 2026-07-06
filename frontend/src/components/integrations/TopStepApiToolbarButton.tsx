import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopStepApiPaused } from '../../hooks/useTopStepApiPaused';
import integrationsService from '../../services/integrationsService';
import ConfirmModal from '../ui/ConfirmModal';
import { Tooltip } from '../ui';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TopStepApiToolbarButtonProps {
  tooltipPosition?: TooltipPosition;
  /** w-8 h-8 pour l’en-tête de modale ; p-2 pour les cartes stratégie */
  size?: 'modal' | 'card';
  className?: string;
}

export const TopStepApiToolbarButton: React.FC<TopStepApiToolbarButtonProps> = ({
  tooltipPosition = 'bottom',
  size = 'modal',
  className = '',
}) => {
  const { t } = useTranslation(['positionStrategies', 'dashboard']);
  const { paused, saving, pauseApi, activateLiveApi } = useTopStepApiPaused();
  const [hasTopStepIntegration, setHasTopStepIntegration] = useState<boolean | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await integrationsService.listIntegrations();
        if (cancelled) return;
        const topstepx = data.integrations.find((item) => item.provider === 'topstepx');
        setHasTopStepIntegration(Boolean(topstepx?.configured));
      } catch {
        if (!cancelled) {
          setHasTopStepIntegration(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (hasTopStepIntegration !== true) {
    return null;
  }

  const handleClick = () => {
    if (paused) {
      setConfirmOpen(true);
      return;
    }
    void pauseApi();
  };

  const handleConfirmActivate = async () => {
    setConfirmLoading(true);
    try {
      await activateLiveApi();
      setConfirmOpen(false);
    } finally {
      setConfirmLoading(false);
    }
  };

  const tooltip = paused
    ? t('positionStrategies:topstepApiPausedTooltip')
    : t('positionStrategies:topstepApiActiveTooltip');

  const sizeClass =
    size === 'modal'
      ? 'w-8 h-8 rounded-lg'
      : 'p-2 rounded-lg transition-all duration-200';

  const stateClass = paused
    ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
    : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20';

  return (
    <>
      <Tooltip content={tooltip} position={tooltipPosition}>
        <button
          type="button"
          onClick={handleClick}
          disabled={saving || confirmLoading}
          aria-pressed={paused}
          aria-label={tooltip}
          className={`flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${stateClass} ${className}`.trim()}
        >
          {paused ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          )}
        </button>
      </Tooltip>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => {
          if (!confirmLoading) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={handleConfirmActivate}
        isLoading={confirmLoading}
        variant="warning"
        title={t('dashboard:marketQuotes.confirmActivateTitle')}
        message={t('dashboard:marketQuotes.confirmActivateMessage')}
        confirmButtonText={t('dashboard:marketQuotes.confirmActivateButton')}
      />
    </>
  );
};
