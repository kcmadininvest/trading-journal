import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import { maskValue } from '../../hooks/usePrivacySettings';
import { formatCurrency, formatNumber, getCurrencySymbolForCode } from '../../utils/numberFormat';
import { usePreferences } from '../../hooks/usePreferences';
import { currenciesService, type Currency } from '../../services/currencies';
import type { PeriodPerformance, PeriodPerformanceEntry } from '../../services/dashboard';
import {
  DASHBOARD_INNER_CARD_CLASS,
  DASHBOARD_INNER_LABEL_CLASS,
  DASHBOARD_PANEL_HINT_CLASS,
  DASHBOARD_PANEL_SHELL_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  DASHBOARD_PNL_NEGATIVE_TEXT_CLASS,
  DASHBOARD_PNL_POSITIVE_TEXT_CLASS,
} from './tickerShell';

export interface PeriodPerformanceKpisProps {
  data: PeriodPerformance | null | undefined;
  currencySymbol?: string;
  pnlCurrencyMode?: 'single' | 'mixed';
  hideMoney?: boolean;
  loading?: boolean;
  className?: string;
  /** true = un compte précis sélectionné (pas « Tous les comptes ») */
  singleAccountSelected?: boolean;
}

type PeriodKey = 'day' | 'week' | 'month' | 'year';

const PERIOD_KEYS: PeriodKey[] = ['day', 'week', 'month', 'year'];

const PREVIOUS_PERIOD_LABEL: Record<PeriodKey, string> = {
  day: 'dashboard:periodPerformance.vsYesterday',
  week: 'dashboard:periodPerformance.vsLastWeek',
  month: 'dashboard:periodPerformance.vsLastMonth',
  year: 'dashboard:periodPerformance.vsLastYear',
};

function getPnLCardClasses(pnl: number): string {
  if (pnl > 0) return 'border-blue-400/30 bg-blue-500/10';
  if (pnl < 0) return 'border-pink-400/30 bg-pink-500/10';
  return 'border-white/15 bg-white/5';
}

function getPnLTextClasses(pnl: number): string {
  if (pnl > 0) return DASHBOARD_PNL_POSITIVE_TEXT_CLASS;
  if (pnl < 0) return DASHBOARD_PNL_NEGATIVE_TEXT_CLASS;
  return 'text-white/90';
}

function getChangeBadgeClasses(changePct: number): string {
  if (changePct > 0) return 'bg-blue-500/15 text-blue-300';
  if (changePct < 0) return 'bg-pink-500/15 text-pink-300';
  return 'bg-white/10 text-white/60';
}

interface PeriodCardProps {
  periodKey: PeriodKey;
  entry: PeriodPerformanceEntry;
  currencySymbol: string;
  pnlCurrencyMode: 'single' | 'mixed';
  hideMoney: boolean;
  singleAccountSelected: boolean;
}

const PeriodCard: React.FC<PeriodCardProps> = ({
  periodKey,
  entry,
  currencySymbol,
  pnlCurrencyMode,
  hideMoney,
  singleAccountSelected,
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();

  const vsLabel =
    periodKey === 'year' && entry.comparison_basis === 'full_prior_calendar_year'
      ? t('dashboard:periodPerformance.vsFullPriorYear', {
          year: entry.prior_calendar_year ?? new Date().getFullYear() - 1,
          defaultValue: 'vs année {{year}} (totale)',
        })
      : t(PREVIOUS_PERIOD_LABEL[periodKey], {
          defaultValue:
            periodKey === 'day'
              ? 'vs hier'
              : periodKey === 'week'
                ? 'vs semaine dernière'
                : periodKey === 'month'
                  ? 'vs mois dernier'
                  : 'vs année dernière',
        });

  const formatPnLValue = (value: number) => {
    if (hideMoney) {
      return maskValue(value, pnlCurrencyMode === 'mixed' ? undefined : currencySymbol);
    }
    if (pnlCurrencyMode === 'mixed') {
      const formatted = formatNumber(value, 2, preferences.number_format);
      return `${value >= 0 ? '+' : ''}${formatted}`;
    }
    return formatCurrency(value, currencySymbol, preferences.number_format, 2);
  };

  const formatPct = (value: number | null) => {
    if (hideMoney) return '***';
    if (value === null || value === undefined) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${formatNumber(value, 1, preferences.number_format)}%`;
  };

  const changePct = entry.change_pct;
  const periodPnlIsZero = Math.abs(entry.pnl) < 1e-9;
  const hasPreviousBaseline = Math.abs(entry.previous_pnl ?? 0) >= 1e-9;
  const showChangeBadge =
    !periodPnlIsZero &&
    hasPreviousBaseline &&
    changePct !== null &&
    changePct !== undefined;
  const showChangeUnavailable = !periodPnlIsZero && !hasPreviousBaseline;
  const priorYear = entry.prior_calendar_year ?? new Date().getFullYear() - 1;
  const yearUnavailableHint =
    periodKey === 'year' && showChangeUnavailable && !hideMoney
      ? singleAccountSelected
        ? t('dashboard:periodPerformance.noPriorYearOnAccount', {
            year: priorYear,
            defaultValue: 'Aucun trade en {{year}} sur ce compte',
          })
        : t('dashboard:periodPerformance.noPriorYearAnywhere', {
            year: priorYear,
            defaultValue: 'Aucun trade en {{year}}',
          })
      : null;

  return (
    <div
      className={clsx(
        DASHBOARD_INNER_CARD_CLASS,
        'flex min-w-0 flex-col gap-2 p-4',
        getPnLCardClasses(entry.pnl)
      )}
    >
      <span className={DASHBOARD_INNER_LABEL_CLASS}>
        {t(`dashboard:periodPerformance.${periodKey}`, {
          defaultValue:
            periodKey === 'day'
              ? "Aujourd'hui"
              : periodKey === 'week'
                ? 'Cette semaine'
                : periodKey === 'month'
                  ? 'Ce mois'
                  : 'Cette année',
        })}
      </span>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={clsx(
            'text-xl font-semibold tabular-nums sm:text-2xl',
            hideMoney ? 'text-white/70' : getPnLTextClasses(entry.pnl)
          )}
        >
          {formatPnLValue(entry.pnl)}
        </span>

        {showChangeBadge ? (
          <Tooltip
            disabled={hideMoney}
            content={
              periodKey === 'year' && entry.comparison_basis === 'full_prior_calendar_year'
                ? t('dashboard:periodPerformance.changePctFullYearTooltip', {
                    defaultValue:
                      "Évolution du PnL année en cours par rapport au total de l'année civile précédente (aucun trade sur la même tranche à date).",
                    year: entry.prior_calendar_year ?? new Date().getFullYear() - 1,
                  })
                : t('dashboard:periodPerformance.changePctTooltip', {
                    defaultValue:
                      'Évolution du PnL par rapport à la période précédente (même durée calendaire).',
                    previous: vsLabel,
                  })
            }
          >
            <span
              className={clsx(
                'inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                hideMoney ? 'bg-white/10 text-white/50' : getChangeBadgeClasses(changePct)
              )}
            >
              {!hideMoney && changePct !== 0 && (
                <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                  {changePct > 0 ? (
                    <path
                      fillRule="evenodd"
                      d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
              )}
              <span>
                {formatPct(changePct)} {vsLabel}
              </span>
            </span>
          </Tooltip>
        ) : showChangeUnavailable ? (
          <Tooltip
            disabled={hideMoney}
            content={
              periodKey === 'year' && singleAccountSelected
                ? t('dashboard:periodPerformance.noPriorYearOnAccountTooltip', {
                    year: priorYear,
                    defaultValue:
                      "Ce compte n'a aucun trade en {{year}} (même sur l'année complète). Vos trades {{year}} sont peut‑être sur un autre compte : essayez « Tous les comptes ».",
                  })
                : t('dashboard:periodPerformance.changePctUnavailableTooltip', {
                    defaultValue:
                      'Impossible de calculer l’évolution : la période précédente n’a pas de PnL.',
                  })
            }
          >
            <span className="inline-flex w-fit max-w-full shrink-0 items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium leading-snug text-white/60">
              {hideMoney ? '***' : yearUnavailableHint ?? `— ${vsLabel}`}
            </span>
          </Tooltip>
        ) : null}
      </div>

      {entry.return_on_capital_pct !== null &&
        entry.return_on_capital_pct !== undefined &&
        entry.return_on_capital_pct !== 0 && (
          <Tooltip
            disabled={hideMoney}
            content={t('dashboard:periodPerformance.returnOnCapitalTooltip', {
              defaultValue:
                'Rendement du PnL de la période rapporté au capital initial du (des) compte(s) affiché(s).',
            })}
          >
            <span className="text-xs text-white/60">
              {hideMoney
                ? maskValue(null)
                : t('dashboard:periodPerformance.returnOnCapital', {
                    defaultValue: '{{pct}} sur capital',
                    pct: `${entry.return_on_capital_pct >= 0 ? '+' : ''}${formatNumber(
                      entry.return_on_capital_pct,
                      2,
                      preferences.number_format
                    )}%`,
                  })}
            </span>
          </Tooltip>
        )}
    </div>
  );
};

export const PeriodPerformanceKpis: React.FC<PeriodPerformanceKpisProps> = ({
  data,
  currencySymbol = '',
  pnlCurrencyMode = 'single',
  hideMoney = false,
  loading = false,
  className = '',
  singleAccountSelected = false,
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  useEffect(() => {
    let cancelled = false;
    currenciesService
      .list()
      .then((list) => {
        if (!cancelled) setCurrencies(list);
      })
      .catch(() => {
        if (!cancelled) setCurrencies([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayCurrencySymbol = useMemo(() => {
    if (pnlCurrencyMode === 'mixed') return '';
    const code = preferences.default_currency || 'USD';
    const fromSettings = getCurrencySymbolForCode(code, currencies);
    return fromSettings || currencySymbol;
  }, [pnlCurrencyMode, preferences.default_currency, currencies, currencySymbol]);

  if (loading) {
    return (
      <div className={clsx(DASHBOARD_PANEL_SHELL_CLASS, className)}>
        <div className="mb-3 h-5 w-48 animate-pulse rounded bg-white/10 sm:mb-4" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PERIOD_KEYS.map((key) => (
            <div
              key={key}
              className={clsx(DASHBOARD_INNER_CARD_CLASS, 'animate-pulse p-4')}
            >
            <div className="mb-3 h-3 w-24 rounded bg-white/10" />
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-8 w-32 rounded bg-white/10" />
              <div className="h-5 w-36 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <section
      className={clsx(DASHBOARD_PANEL_SHELL_CLASS, className)}
      aria-label={t('dashboard:periodPerformance.sectionTitle', {
        defaultValue: 'Performance récente',
      })}
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:mb-4">
        <h2 className={DASHBOARD_PANEL_TITLE_CLASS}>
          {t('dashboard:periodPerformance.sectionTitle', { defaultValue: 'Performance récente' })}
        </h2>
        <span className={DASHBOARD_PANEL_HINT_CLASS}>
          {t('dashboard:periodPerformance.sectionScopeHint', {
            defaultValue: '(Indépendant du filtre de période ci-dessus)',
          })}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PERIOD_KEYS.map((key) => {
          const entry = data[key];
          if (!entry) return null;
          return (
          <PeriodCard
            key={key}
            periodKey={key}
            entry={entry}
            currencySymbol={displayCurrencySymbol}
            pnlCurrencyMode={pnlCurrencyMode}
            hideMoney={hideMoney}
            singleAccountSelected={singleAccountSelected}
          />
          );
        })}
      </div>
    </section>
  );
};