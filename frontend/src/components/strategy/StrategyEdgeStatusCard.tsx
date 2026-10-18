import React, { useCallback } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type {
  StrategyEdgeConfidence,
  StrategyEdgeStatus,
  StrategyEdgeStatusValue,
} from '../../services/tradeStrategies';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../../utils/numberFormat';
import { maskValue } from '../../hooks/usePrivacySettings';
import {
  VERDICT_BADGE_CLASSES,
  VERDICT_CARD_CLASSES,
  VERDICT_TEXT_CLASSES,
  type GaugeVerdictLevel,
} from '../../utils/getGaugeVerdict';

interface StrategyEdgeStatusCardProps {
  edgeStatus: StrategyEdgeStatus | null | undefined;
  strategySelected: boolean;
  currencySymbol: string;
  hideProfitLoss?: boolean;
}

function statusToVerdict(status: StrategyEdgeStatusValue): GaugeVerdictLevel {
  if (status === 'present') return 'good';
  if (status === 'fading' || status === 'insufficient') return 'average';
  return 'poor';
}

const CONFIDENCE_BADGE_CLASSES: Record<StrategyEdgeConfidence, string> = {
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  medium: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
};

export const StrategyEdgeStatusCard: React.FC<StrategyEdgeStatusCardProps> = React.memo(
  ({ edgeStatus, strategySelected, currencySymbol, hideProfitLoss = false }) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();

    const formatNumber = useCallback(
      (value: number, digits: number = 2) => formatNumberUtil(value, digits, preferences.number_format),
      [preferences.number_format]
    );
    const formatCurrency = useCallback(
      (value: number) => formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2),
      [preferences.number_format, currencySymbol]
    );

    const formatMoney = (value: number | null | undefined) => {
      if (value == null || !Number.isFinite(value)) {
        return t('strategies:edgeStatus.na');
      }
      if (hideProfitLoss) {
        return maskValue(null, currencySymbol);
      }
      return formatCurrency(value);
    };

    if (!strategySelected) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/40 px-4 py-4 sm:px-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('strategies:edgeStatus.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('strategies:edgeStatus.selectStrategy')}
          </p>
        </div>
      );
    }

    if (!edgeStatus) {
      return null;
    }

    const verdict = statusToVerdict(edgeStatus.status);
    const windowSize = edgeStatus.trailing_window || 30;
    const confidence = edgeStatus.confidence ?? null;
    const pfLabel = edgeStatus.trailing_profit_factor_infinite
      ? t('strategies:edgeStatus.profitFactorInfinite')
      : edgeStatus.trailing_profit_factor != null
        ? formatNumber(edgeStatus.trailing_profit_factor, 2)
        : t('strategies:edgeStatus.na');

    const uncertainty = edgeStatus.trailing_uncertainty;
    const uncertaintyLabel =
      uncertainty && !hideProfitLoss
        ? t('strategies:edgeStatus.uncertaintyBand', {
            low: formatCurrency(uncertainty.low),
            high: formatCurrency(uncertainty.high),
          })
        : null;

    return (
      <div className={clsx('rounded-lg border px-4 py-4 shadow-sm sm:px-6', VERDICT_CARD_CLASSES[verdict])}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('strategies:edgeStatus.title')}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t('strategies:edgeStatus.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {confidence ? (
              <span
                className={clsx(
                  'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                  CONFIDENCE_BADGE_CLASSES[confidence]
                )}
              >
                {t(`strategies:edgeStatus.confidence.${confidence}`)}
              </span>
            ) : null}
            <span
              className={clsx(
                'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                VERDICT_BADGE_CLASSES[verdict]
              )}
            >
              {t(`strategies:edgeStatus.status.${edgeStatus.status}`)}
            </span>
          </div>
        </div>

        <p className={clsx('mt-3 text-sm font-medium', VERDICT_TEXT_CLASSES[verdict])}>
          {t(`strategies:edgeStatus.hint.${edgeStatus.status}`, { count: windowSize })}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('strategies:edgeStatus.baseline')}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {formatMoney(edgeStatus.baseline_expectancy)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('strategies:edgeStatus.trailing', { count: windowSize })}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {formatMoney(edgeStatus.trailing_expectancy)}
            </p>
            {uncertaintyLabel ? (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {uncertaintyLabel}
              </p>
            ) : null}
            {edgeStatus.trailing_sign_uncertain ? (
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                {t('strategies:edgeStatus.signUncertain')}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('strategies:edgeStatus.trailingPf')}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {pfLabel}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('strategies:edgeStatus.sample')}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {formatNumber(edgeStatus.sample_size, 0)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {t('strategies:edgeStatus.basisLabel')}:{' '}
            {edgeStatus.basis === 'all'
              ? t('strategies:edgeStatus.basisAll')
              : t('strategies:edgeStatus.basisRespected')}
          </span>
          <span>{t('strategies:edgeStatus.periodIndependent')}</span>
          <span>{t('strategies:edgeStatus.familyScope')}</span>
        </div>

        {edgeStatus.fallback_warning ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            {t('strategies:edgeStatus.fallbackWarning', {
              respected: formatNumber(edgeStatus.respected_sample_size ?? 0, 0),
            })}
          </p>
        ) : null}
      </div>
    );
  }
);

StrategyEdgeStatusCard.displayName = 'StrategyEdgeStatusCard';
