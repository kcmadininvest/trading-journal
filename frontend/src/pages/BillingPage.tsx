import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast/headless';
import { PageShell } from '../components/layout';
import { billingService, SubscriptionStatus } from '../services/billing';

interface BillingPageProps {
  billingStatus: SubscriptionStatus | null;
  onSubscriptionChanged: () => Promise<void>;
}

const BillingPage: React.FC<BillingPageProps> = ({ billingStatus, onSubscriptionChanged }) => {
  const { t } = useI18nTranslation();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  const handleSubscribe = async () => {
    setIsLoadingCheckout(true);
    try {
      const { checkout_url } = await billingService.createCheckoutSession();
      window.location.href = checkout_url;
    } catch (error: any) {
      toast.error(error?.message || t('billing:errors.checkoutFailed'));
      setIsLoadingCheckout(false);
    }
  };

  const handleManage = async () => {
    setIsLoadingPortal(true);
    try {
      const { portal_url } = await billingService.createPortalSession();
      window.location.href = portal_url;
    } catch (error: any) {
      toast.error(error?.message || t('billing:errors.portalFailed'));
      setIsLoadingPortal(false);
    }
  };

  const statusLabel = billingStatus ? t(`billing:status.${billingStatus.access_state}`) : t('billing:status.loading');
  const isTrialing = billingStatus?.access_state === 'trialing';
  const isTrialExpired = isTrialing && (billingStatus?.trial_days_left ?? 0) <= 0;
  const primaryCtaLabel = isTrialExpired ? t('billing:cta.subscribeNow') : t('billing:cta.subscribe');
  const canSubscribe = Boolean(billingStatus?.can_subscribe);
  const showManage = Boolean(
    billingStatus && !billingStatus.can_subscribe && billingStatus.access_state !== 'admin_bypass'
  );

  const nextActionMessage = (() => {
    if (!billingStatus) {
      return null;
    }
    if (billingStatus.access_state === 'active') {
      return t('billing:messages.active');
    }
    if (isTrialExpired) {
      return t('billing:messages.trialExpired');
    }
    if (isTrialing) {
      return t('billing:messages.trialActive');
    }
    return t('billing:messages.inactive');
  })();

  return (
    <PageShell variant="default">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {t('billing:title')}
          </h2>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-300">{t('billing:description')}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 md:p-8 shadow-sm space-y-5">
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-4 md:p-5">
              <p className="text-sm md:text-base font-medium text-blue-800 dark:text-blue-100">
                {t('billing:currentStatus', { status: statusLabel })}
              </p>
              {billingStatus?.access_state === 'trialing' && (
                <p className="mt-2 text-sm md:text-base text-blue-700 dark:text-blue-200">
                  {t('billing:trialDaysLeft', { count: billingStatus.trial_days_left })}
                </p>
              )}
              {nextActionMessage && (
                <p className="mt-3 text-sm md:text-base text-blue-800 dark:text-blue-100 leading-relaxed">
                  {nextActionMessage}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                {statusLabel}
              </span>
              {isTrialing && (
                <span className="inline-flex items-center rounded-full border border-blue-300 dark:border-blue-700 bg-blue-100 dark:bg-blue-900/40 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-200">
                  {t('billing:trialDaysLeft', { count: billingStatus?.trial_days_left ?? 0 })}
                </span>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 md:p-6 shadow-sm space-y-4 h-fit">
            <div className="space-y-3">
              {canSubscribe && !billingStatus?.checkout_enabled ? (
                <button
                  type="button"
                  className="w-full rounded-xl px-5 py-3 bg-gray-300 text-gray-700 cursor-not-allowed"
                  disabled
                >
                  {t('billing:cta.unavailable')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={isLoadingCheckout || !canSubscribe}
                  className="w-full rounded-xl px-5 py-3 bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition"
                >
                  {isLoadingCheckout ? t('billing:cta.redirecting') : primaryCtaLabel}
                </button>
              )}

              {showManage && (
                <button
                  type="button"
                  onClick={handleManage}
                  disabled={isLoadingPortal}
                  className="w-full rounded-xl px-5 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-70"
                >
                  {isLoadingPortal ? t('billing:cta.redirecting') : t('billing:cta.manage')}
                </button>
              )}
            </div>

            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={onSubscriptionChanged}
            >
              {t('billing:cta.refresh')}
            </button>
          </aside>
        </div>
      </div>
    </PageShell>
  );
};

export default BillingPage;

