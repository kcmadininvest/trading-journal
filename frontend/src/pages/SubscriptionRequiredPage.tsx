import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast/headless';
import { PageShell } from '../components/layout';
import { billingService } from '../services/billing';

interface SubscriptionRequiredPageProps {
  onBackToDashboard: () => void;
}

const SubscriptionRequiredPage: React.FC<SubscriptionRequiredPageProps> = ({ onBackToDashboard }) => {
  const { t } = useI18nTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const { checkout_url } = await billingService.createCheckoutSession();
      window.location.href = checkout_url;
    } catch {
      toast.error(t('billing:errors.checkoutFailed'));
      setIsLoading(false);
    }
  };

  return (
    <PageShell variant="narrow">
      <div className="rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-6 md:p-8 shadow-sm">
        <h2 className="text-xl md:text-2xl font-semibold text-amber-900 dark:text-amber-100">
          {t('billing:locked.title')}
        </h2>
        <p className="mt-3 text-sm md:text-base text-amber-800 dark:text-amber-200">
          {t('billing:locked.description')}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={isLoading}
            className="rounded-xl px-5 py-3 bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-70"
          >
            {isLoading ? t('billing:cta.redirecting') : t('billing:cta.subscribe')}
          </button>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="rounded-xl px-5 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            {t('billing:cta.backToDashboard')}
          </button>
        </div>
      </div>
    </PageShell>
  );
};

export default SubscriptionRequiredPage;

