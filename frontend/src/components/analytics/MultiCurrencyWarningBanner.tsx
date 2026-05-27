import React from 'react';
import { useTranslation } from 'react-i18next';

interface MultiCurrencyWarningBannerProps {
  show: boolean;
  className?: string;
}

export const MultiCurrencyWarningBanner: React.FC<MultiCurrencyWarningBannerProps> = ({
  show,
  className = '',
}) => {
  const { t } = useTranslation('analytics');

  if (!show) return null;

  return (
    <div
      role="status"
      className={`rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 ${className}`}
    >
      {t('multiCurrency.noConversionWarning')}
    </div>
  );
};
