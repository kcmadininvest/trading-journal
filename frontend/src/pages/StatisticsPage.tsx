import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStatistics, useAnalytics, useTradesUpdateInvalidation } from '../hooks/useStatistics';
import { useTradingAccounts } from '../hooks/useStatistics';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { formatDate } from '../utils/dateFormat';
import { TradingAccountSelector } from '../components/TradingAccount/TradingAccountSelector';
import { TradingAccount } from '../services/tradingAccounts';
import { StatisticsPageSkeleton } from '../components/ui/StatisticsPageSkeleton';
import { currenciesService, Currency } from '../services/currencies';
import { tradesService, TradeListItem } from '../services/trades';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { usePreferences } from '../hooks/usePreferences';
import { PeriodSelector, PeriodRange } from '../components/common/PeriodSelector';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { MetricCard, MetricItem } from '../components/statistics/MetricCard';
import { MetricGroup } from '../components/statistics/MetricGroup';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountIndicatorsGrid } from '../components/common/AccountIndicatorsGrid';

function StatisticsPage() {
  const { t } = useI18nTranslation();
  const { preferences, loading: preferencesLoading } = usePreferences();
  const { selectedAccountId, setSelectedAccountId, loading: accountLoading } = useTradingAccount();
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [allTrades, setAllTrades] = useState<TradeListItem[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<TradeListItem[]>([]);
  // Utiliser un sélecteur de période moderne
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodRange | null>(() => {
    // Par défaut: 3 derniers mois
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    return {
      start: `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`,
      end: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      preset: 'last3Months',
    };
  });
  // Garder pour compatibilité
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  
  // Hooks pour les données
  const { data: accounts, isLoading: accountsLoading } = useTradingAccounts();
  // Passer undefined si le compte est en cours de chargement pour éviter de charger avec un mauvais accountId
  const { data: statisticsData, isLoading: statisticsLoading, error: statisticsError } = useStatistics(
    accountLoading ? undefined : selectedAccountId, 
    selectedPeriod ? null : selectedYear, 
    selectedPeriod ? null : selectedMonth,
    selectedPeriod?.start || null,
    selectedPeriod?.end || null
  );
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useAnalytics(
    accountLoading ? undefined : selectedAccountId, 
    selectedPeriod ? null : selectedYear, 
    selectedPeriod ? null : selectedMonth,
    selectedPeriod?.start || null,
    selectedPeriod?.end || null
  );
  
  // Fonction pour recharger les statistiques après un import
  const reloadStatistics = () => {
    // Forcer le rechargement en modifiant temporairement la période puis en la remettant
    // Cela déclenchera le useEffect des hooks useStatistics et useAnalytics
    const currentPeriod = selectedPeriod;
    const currentYear = selectedYear;
    const currentMonth = selectedMonth;
    if (currentPeriod) {
      setSelectedPeriod(null);
      setTimeout(() => {
        setSelectedPeriod(currentPeriod);
      }, 0);
    } else {
      setSelectedYear(null);
      setSelectedMonth(null);
      setTimeout(() => {
        setSelectedYear(currentYear);
        setSelectedMonth(currentMonth);
      }, 0);
    }
  };
  
  // Charger les devises
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const list = await currenciesService.list();
        setCurrencies(list);
      } catch (error) {
        console.error('Error loading currencies:', error);
      }
    };
    loadCurrencies();
  }, []);

  // Obtenir le symbole de la devise du compte sélectionné
  const currencySymbol = useMemo(() => {
    if (!selectedAccount?.currency) return '';
    const currency = currencies.find(c => c.code === selectedAccount.currency);
    return currency?.symbol || '';
  }, [selectedAccount, currencies]);

  // Générer les années disponibles (année en cours et 5 ans précédents)
  
  // Gérer l'invalidation des queries quand les trades sont mis à jour
  useTradesUpdateInvalidation();
  
  // États de chargement
  // Inclure preferencesLoading et accountLoading pour éviter d'afficher le skeleton avant que le thème et le compte soient chargés
  const isLoading = preferencesLoading || accountLoading || accountsLoading || statisticsLoading || analyticsLoading;
  const hasError = statisticsError || analyticsError;
  
  // Charger les détails du compte sélectionné pour obtenir la devise
  useEffect(() => {
    const loadAccount = async () => {
      if (!selectedAccountId) {
        setSelectedAccount(null);
        return;
      }
      try {
        const account = accounts?.find(acc => acc.id === selectedAccountId);
        if (account) {
          setSelectedAccount(account);
        }
      } catch (err) {
        console.error('Erreur lors du chargement du compte', err);
        setSelectedAccount(null);
      }
    };
    loadAccount();
  }, [selectedAccountId, accounts]);

  // Charger tous les trades du compte pour calculer le solde
  useEffect(() => {
    const loadAllTrades = async () => {
      if (!selectedAccountId || accountLoading) {
        setAllTrades([]);
        return;
      }
      try {
        const response = await tradesService.list({
          trading_account: selectedAccountId,
          page_size: 10000, // Charger tous les trades
        });
        setAllTrades(response.results);
      } catch (err) {
        console.error('Erreur lors du chargement des trades', err);
        setAllTrades([]);
      }
    };
    loadAllTrades();
  }, [selectedAccountId, accountLoading]);

  // Charger les trades filtrés pour la période sélectionnée
  useEffect(() => {
    const loadFilteredTrades = async () => {
      if (!selectedAccountId || accountLoading) {
        setFilteredTrades([]);
        return;
      }
      try {
        const params: any = {
          trading_account: selectedAccountId,
          page_size: 10000,
        };
        
        if (selectedPeriod) {
          params.start_date = selectedPeriod.start;
          params.end_date = selectedPeriod.end;
        } else if (selectedYear) {
          const startDate = selectedMonth 
            ? `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`
            : `${selectedYear}-01-01`;
          const endDate = selectedMonth
            ? (() => {
                const lastDay = new Date(selectedYear, selectedMonth, 0);
                return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
              })()
            : `${selectedYear}-12-31`;
          params.start_date = startDate;
          params.end_date = endDate;
        }
        
        const response = await tradesService.list(params);
        setFilteredTrades(response.results);
      } catch (err) {
        console.error('Erreur lors du chargement des trades filtrés', err);
        setFilteredTrades([]);
      }
    };
    loadFilteredTrades();
  }, [selectedAccountId, accountLoading, selectedPeriod, selectedYear, selectedMonth]);

  // Utiliser le hook pour calculer les indicateurs de compte de manière cohérente
  const indicators = useAccountIndicators({
    selectedAccount,
    allTrades,
    filteredTrades,
    analyticsData,
  });

  // Alias pour compatibilité avec le code existant
  const bestAndWorstDays = indicators.bestAndWorstDays;
  
  // Fonctions utilitaires - DOIT être avant tous les return conditionnels
  // Wrapper pour formatCurrency avec préférences
  const formatCurrency = useCallback((value: number, currencySymbol: string = ''): string => {
    return formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2);
  }, [preferences.number_format]);

  const formatNumber = useCallback((value: number, digits: number = 2) => {
    return formatNumberUtil(value, digits, preferences.number_format);
  }, [preferences.number_format]);
  
  // Gestion des erreurs
  if (hasError) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="text-center py-12">
          <div className="text-red-500 dark:text-red-400 text-lg mb-4">{t('statistics:errorLoadingData')}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700"
          >
            {t('statistics:retry')}
          </button>
        </div>
      </div>
    );
  }
  
  // Skeleton pendant le chargement
  if (isLoading) {
    return <StatisticsPageSkeleton />;
  }

  const formatVolume = (volume: string) => {
    if (!volume) return 'N/A';
    const num = parseFloat(volume);
    
    if (num >= 1000000) {
      return `${formatNumber(num / 1000000, 1)}M`;
    } else if (num >= 1000) {
      return `${formatNumber(num / 1000, 1)}K`;
    } else if (num >= 1) {
      return formatNumber(num, 0);
    } else {
      return formatNumber(num, 2);
    }
  };
  
  const formatRatio = (ratio: number) => {
    const absRatio = Math.abs(ratio);
    
    if (absRatio >= 1) {
      return formatNumber(ratio, 2);
    } else if (absRatio >= 0.01) {
      return formatNumber(ratio, 4);
    } else {
      return formatNumber(ratio, 6);
    }
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="w-full">
        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            {/* Compte de trading */}
            <div className="flex-shrink-0 lg:w-80">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('statistics:tradingAccount')}
              </label>
              <TradingAccountSelector
                selectedAccountId={selectedAccountId}
                onAccountChange={(account) => {
                  setSelectedAccountId(account?.id ?? null);
                  setSelectedAccount(account);
                }}
                hideLabel
              />
            </div>
            
            {/* Sélecteur de période moderne */}
            <div className="flex-shrink-0 lg:w-80">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('statistics:period', { defaultValue: 'Période' })}
              </label>
              <PeriodSelector
                value={selectedPeriod}
                onChange={(period) => {
                  setSelectedPeriod(period);
                  // Réinitialiser les anciens sélecteurs
                  setSelectedYear(null);
                  setSelectedMonth(null);
                }}
              />
            </div>
          </div>
        </div>

        {/* Soldes du compte */}
        {selectedAccount && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
            <AccountIndicatorsGrid 
              indicators={indicators} 
              currencySymbol={currencySymbol} 
            />
          </div>
        )}

        {/* Niveau 1: Hero Metrics - KPIs Principaux */}
        {statisticsData && (
          <div className="mb-6">
            <div className="mb-3">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('statistics:overview.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('statistics:overview.subtitle')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={t('statistics:overview.performance', { defaultValue: 'Performance' })}
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                <MetricItem
                  label={t('statistics:overview.totalPnL')}
                  value={formatCurrency(parseFloat(statisticsData.total_pnl), currencySymbol)}
                  tooltip={t('statistics:overview.totalPnL')}
                  variant={parseFloat(statisticsData.total_pnl) >= 0 ? 'success' : 'danger'}
                />
                <MetricItem
                  label={t('statistics:overview.winRate')}
                  value={`${formatNumber(statisticsData.win_rate, 1)}%`}
                  tooltip={t('statistics:overview.winRate')}
                  variant={statisticsData.win_rate >= 50 ? 'success' : statisticsData.win_rate >= 40 ? 'warning' : 'danger'}
                />
              </MetricCard>

              <MetricCard
                title={t('statistics:performanceRatios.drawdownAndRunup', { defaultValue: 'Drawdown & Run-up' })}
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
              >
                <MetricItem
                  label={t('statistics:performanceRatios.maxDrawdown', { defaultValue: 'Max Drawdown' })}
                  value={`${formatNumber(statisticsData.max_drawdown_global_pct, 2)}% (${formatCurrency(statisticsData.max_drawdown_global, currencySymbol)})`}
                  tooltip={t('statistics:performanceRatios.maxDrawdownGlobalTooltip', { defaultValue: 'Plus grande baisse depuis un pic (tous les temps). Indicateur de risque. Plus bas = moins de risque.' })}
                  variant="default"
                />
                <MetricItem
                  label={t('statistics:performanceRatios.maxRunupGlobal', { defaultValue: 'Max Run-up Global' })}
                  value={`${formatNumber(statisticsData.max_runup_global_pct, 2)}% (${formatCurrency(statisticsData.max_runup_global, currencySymbol)})`}
                  tooltip={t('statistics:performanceRatios.maxRunupTooltip', { defaultValue: 'Plus grande hausse depuis un point bas' })}
                  variant="default"
                />
              </MetricCard>

              <MetricCard
                title={t('statistics:performanceRatios.temporalAnalysis')}
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                <MetricItem
                  label={t('statistics:performanceRatios.frequency')}
                  value={`${formatNumber(statisticsData.frequency_ratio, 1)} ${t('statistics:performanceRatios.tradesPerDay')}`}
                  tooltip={t('statistics:performanceRatios.frequencyTooltip')}
                  variant="info"
                />
                <MetricItem
                  label={t('statistics:overview.averageDuration')}
                  value={statisticsData.average_duration}
                  variant="info"
                />
                <MetricItem
                  label={t('statistics:performanceRatios.durationRatio')}
                  value={formatNumber(statisticsData.duration_ratio, 2)}
                  tooltip={t('statistics:performanceRatios.durationRatioTooltip')}
                  variant={statisticsData.duration_ratio >= 1.0 ? 'success' : 'warning'}
                />
              </MetricCard>

              <MetricCard
                title={t('statistics:overview.generalStatistics')}
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                <MetricItem
                  label={t('statistics:overview.totalTrades')}
                  value={indicators.totalTrades}
                  variant="default"
                />
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:tradesAnalysis.winningTrades', { defaultValue: 'Gagnants' })} :</span>
                    <span className="text-base font-semibold text-blue-500 dark:text-blue-400">{statisticsData.winning_trades}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:tradesAnalysis.losingTrades', { defaultValue: 'Perdants' })} :</span>
                    <span className="text-base font-semibold text-pink-500 dark:text-pink-400">{statisticsData.losing_trades}</span>
                  </div>
                </div>
                <MetricItem
                  label={t('statistics:overview.totalVolume')}
                  value={formatVolume(statisticsData.total_volume)}
                  variant="info"
                />
              </MetricCard>
            </div>
          </div>
        )}

        {/* Niveau 2: Sections Thématiques */}
        {statisticsData && (
          <>
            {/* Section Performance & Risque */}
            <div className="mb-8">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {t('statistics:performanceRatios.performance', { defaultValue: 'Performance' })} & {t('statistics:performanceRatios.riskManagement', { defaultValue: 'Gestion du Risque' })}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {t('statistics:performanceRatios.performanceSubtitle', { defaultValue: 'Métriques de performance globale' })} • {t('statistics:performanceRatios.riskManagementSubtitle', { defaultValue: 'Indicateurs de risque et récupération' })}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title={t('statistics:performanceRatios.mainPerformance')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:performanceRatios.profitFactor')}
                    value={formatNumber(statisticsData.profit_factor, 2)}
                    tooltip={t('statistics:performanceRatios.profitFactorTooltip')}
                    variant={statisticsData.profit_factor >= 1.0 ? 'success' : 'danger'}
                  />
                  <MetricItem
                    label={t('statistics:performanceRatios.winLossRatio')}
                    value={formatNumber(statisticsData.win_loss_ratio, 2)}
                    tooltip={t('statistics:performanceRatios.winLossRatioTooltip')}
                    variant={statisticsData.win_loss_ratio >= 1.0 ? 'success' : 'danger'}
                  />
                  <MetricItem
                    label={t('statistics:performanceRatios.expectancy')}
                    value={formatCurrency(statisticsData.expectancy, currencySymbol)}
                    tooltip={t('statistics:performanceRatios.expectancyTooltip')}
                    variant={statisticsData.expectancy >= 0 ? 'success' : 'danger'}
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:performanceRatios.financialEfficiency')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:performanceRatios.feesRatio')}
                    value={`${formatNumber(statisticsData.fees_ratio * 100, 1)}%`}
                    tooltip={t('statistics:performanceRatios.feesRatioTooltip')}
                    variant={statisticsData.fees_ratio <= 0.1 ? 'success' : 'warning'}
                  />
                  <MetricItem
                    label={t('statistics:performanceRatios.volumePnLRatio')}
                    value={formatRatio(statisticsData.volume_pnl_ratio)}
                    tooltip={t('statistics:performanceRatios.volumePnLRatioTooltip')}
                    variant="default"
                  />
                  <MetricItem
                    label={t('statistics:performanceRatios.tradeEfficiency')}
                    value={`${formatNumber(statisticsData.trade_efficiency, 1)}%`}
                    tooltip={t('statistics:performanceRatios.tradeEfficiencyTooltip')}
                    variant={statisticsData.trade_efficiency >= 50 ? 'success' : statisticsData.trade_efficiency >= 30 ? 'warning' : 'danger'}
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:performanceRatios.riskAdjustedPerformance')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:performanceRatios.sharpeRatio')}
                    value={formatNumber(statisticsData.sharpe_ratio, 2)}
                    tooltip={t('statistics:performanceRatios.sharpeRatioTooltip')}
                    variant={statisticsData.sharpe_ratio >= 1.0 ? 'success' : 'warning'}
                  />
                  <MetricItem
                    label={t('statistics:performanceRatios.sortinoRatio')}
                    value={formatNumber(statisticsData.sortino_ratio, 2)}
                    tooltip={t('statistics:performanceRatios.sortinoRatioTooltip')}
                    variant={statisticsData.sortino_ratio >= 1.0 ? 'success' : 'warning'}
                  />
                  <MetricItem
                    label={t('statistics:performanceRatios.calmarRatio')}
                    value={formatNumber(statisticsData.calmar_ratio, 2)}
                    tooltip={t('statistics:performanceRatios.calmarRatioTooltip')}
                    variant={statisticsData.calmar_ratio >= 1.0 ? 'success' : 'warning'}
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:performanceRatios.recovery')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:performanceRatios.recoveryRatio')}
                    value={formatNumber(statisticsData.recovery_ratio, 2)}
                    tooltip={t('statistics:performanceRatios.recoveryRatioTooltip')}
                    variant={statisticsData.recovery_ratio >= 1.0 ? 'success' : 'warning'}
                  />
                  <MetricItem
                    label={t('statistics:performanceRatios.recoveryTime')}
                    value={
                      statisticsData.recovery_time !== undefined && statisticsData.recovery_time !== null && statisticsData.recovery_time > 0
                        ? `${formatNumber(statisticsData.recovery_time, 1)} ${t('statistics:performanceRatios.trades')}`
                        : t('statistics:performanceRatios.noRecovery', { defaultValue: 'N/A' })
                    }
                    tooltip={t('statistics:performanceRatios.recoveryTimeTooltip')}
                    variant="default"
                  />
                </MetricCard>
              </div>
            </div>

          </>
        )}

        {/* Niveau 3: Analyses Détaillées (Progressive Disclosure) */}
        <MetricGroup
          title={t('statistics:tradesAnalysis.title')}
          subtitle={t('statistics:tradesAnalysis.subtitle')}
          defaultCollapsed={false}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statisticsData && (
              <>
                <MetricCard
                  title={t('statistics:tradesAnalysis.winningTrades')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:tradesAnalysis.count')}
                    value={statisticsData.winning_trades}
                    variant="success"
                  />
                  <MetricItem
                    label={t('statistics:tradesAnalysis.bestTrade')}
                    value={formatCurrency(parseFloat(statisticsData.best_trade), currencySymbol)}
                    variant="success"
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:tradesAnalysis.losingTrades')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:tradesAnalysis.count')}
                    value={statisticsData.losing_trades}
                    variant="danger"
                  />
                  <MetricItem
                    label={t('statistics:tradesAnalysis.worstTrade')}
                    value={formatCurrency(parseFloat(statisticsData.worst_trade), currencySymbol)}
                    variant="danger"
                  />
                </MetricCard>

                {analyticsData?.trade_stats && (
                  <MetricCard
                    title={t('statistics:tradesAnalysis.averageWinVsLoss')}
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    }
                  >
                    <MetricItem
                      label={t('statistics:tradesAnalysis.averageWin')}
                      value={analyticsData.trade_stats.avg_winning_trade ? formatCurrency(analyticsData.trade_stats.avg_winning_trade, currencySymbol) : 'N/A'}
                      variant="success"
                    />
                    <MetricItem
                      label={t('statistics:tradesAnalysis.averageLoss')}
                      value={analyticsData.trade_stats.avg_losing_trade ? formatCurrency(analyticsData.trade_stats.avg_losing_trade, currencySymbol) : 'N/A'}
                      variant="danger"
                    />
                  </MetricCard>
                )}

                <MetricCard
                  title={t('statistics:tradesAnalysis.breakEvenTrades')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:tradesAnalysis.count')}
                    value={statisticsData.break_even_trades || 0}
                    tooltip={t('statistics:tradesAnalysis.breakEvenTradesTooltip')}
                    variant="default"
                  />
                </MetricCard>
              </>
            )}
          </div>
        </MetricGroup>

        <MetricGroup
          title={t('statistics:advancedAnalysis.title')}
          subtitle={t('statistics:advancedAnalysis.subtitle')}
          defaultCollapsed={false}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
            {statisticsData && analyticsData && (
              <>
                <MetricCard
                  title={t('statistics:advancedAnalysis.dailyGains')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.average')}
                    value={formatCurrency(analyticsData.daily_stats.avg_gain_per_day, currencySymbol)}
                    variant="success"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.median')}
                    value={formatCurrency(analyticsData.daily_stats.median_gain_per_day, currencySymbol)}
                    variant="success"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.maximum')}
                    value={formatCurrency(analyticsData.daily_stats.max_gain_per_day, currencySymbol)}
                    variant="success"
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:advancedAnalysis.dailyLosses')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6 6" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.average')}
                    value={formatCurrency(analyticsData.daily_stats.avg_loss_per_day, currencySymbol)}
                    variant="danger"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.median')}
                    value={formatCurrency(analyticsData.daily_stats.median_loss_per_day, currencySymbol)}
                    variant="danger"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.maximum')}
                    value={formatCurrency(analyticsData.daily_stats.max_loss_per_day, currencySymbol)}
                    variant="danger"
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:advancedAnalysis.tradesPerDay')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.average')}
                    value={formatNumber(analyticsData.daily_stats.avg_trades_per_day)}
                    variant="info"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.median')}
                    value={formatNumber(analyticsData.daily_stats.median_trades_per_day)}
                    variant="info"
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:advancedAnalysis.individualTrades')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.maxGain')}
                    value={formatCurrency(analyticsData.trade_stats.max_gain_per_trade, currencySymbol)}
                    variant="success"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.maxLoss')}
                    value={formatCurrency(analyticsData.trade_stats.max_loss_per_trade, currencySymbol)}
                    variant="danger"
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:advancedAnalysis.tradeDurations')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.avgDurationWinningTrade')}
                    value={analyticsData.trade_stats.avg_duration_winning_trade}
                    variant="success"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.avgDurationLosingTrade')}
                    value={analyticsData.trade_stats.avg_duration_losing_trade}
                    variant="danger"
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:advancedAnalysis.dailySequences')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.consecutiveGains')}
                    value={analyticsData.consecutive_stats.max_consecutive_wins_per_day}
                    variant="success"
                    tooltip={t('statistics:advancedAnalysis.consecutiveGainsTooltip')}
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.consecutiveLosses')}
                    value={analyticsData.consecutive_stats.max_consecutive_losses_per_day}
                    variant="danger"
                    tooltip={t('statistics:advancedAnalysis.consecutiveLossesTooltip')}
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:advancedAnalysis.globalSequences')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.consecutiveGains')}
                    value={analyticsData.consecutive_stats.max_consecutive_wins}
                    variant="success"
                    tooltip={t('statistics:advancedAnalysis.consecutiveGainsGlobalTooltip')}
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.consecutiveLosses')}
                    value={analyticsData.consecutive_stats.max_consecutive_losses}
                    variant="danger"
                    tooltip={t('statistics:advancedAnalysis.consecutiveLossesGlobalTooltip')}
                  />
                </MetricCard>

                <MetricCard
                  title={t('statistics:advancedAnalysis.longVsShort')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.longPercentage')}
                    value={`${formatNumber(analyticsData.trade_type_stats.long_percentage, 1)}%`}
                    variant="info"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.shortPercentage')}
                    value={`${formatNumber(analyticsData.trade_type_stats.short_percentage, 1)}%`}
                    variant="warning"
                  />
                </MetricCard>

                <MetricCard
                  title={`${t('statistics:advancedAnalysis.daysWithProfit')} / ${t('statistics:advancedAnalysis.daysWithLoss')}`}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:advancedAnalysis.daysWithProfit')}
                    value={analyticsData.daily_stats.days_with_profit || 0}
                    variant="success"
                  />
                  <MetricItem
                    label={t('statistics:advancedAnalysis.daysWithLoss')}
                    value={analyticsData.daily_stats.days_with_loss || 0}
                    variant="danger"
                  />
                  {analyticsData.daily_stats.days_break_even > 0 && (
                    <MetricItem
                      label={t('statistics:advancedAnalysis.daysBreakEven')}
                      value={analyticsData.daily_stats.days_break_even}
                      variant="default"
                    />
                  )}
                </MetricCard>

                <MetricCard
                  title={`${t('statistics:advancedAnalysis.bestDay')} / ${t('statistics:advancedAnalysis.worstDay')}`}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  <div className="grid grid-cols-2 gap-4">
                    {bestAndWorstDays.bestDay && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('statistics:advancedAnalysis.bestDay')}</div>
                        <div className="text-base font-semibold text-blue-500 dark:text-blue-400">
                          {formatCurrency(bestAndWorstDays.bestDay.pnl, currencySymbol)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(bestAndWorstDays.bestDay.date, preferences.date_format, false)}
                        </div>
                      </div>
                    )}
                    {bestAndWorstDays.worstDay && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('statistics:advancedAnalysis.worstDay')}</div>
                        <div className="text-base font-semibold text-pink-500 dark:text-pink-400">
                          {formatCurrency(bestAndWorstDays.worstDay.pnl, currencySymbol)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(bestAndWorstDays.worstDay.date, preferences.date_format, false)}
                        </div>
                      </div>
                    )}
                  </div>
                </MetricCard>
              </>
            )}
          </div>
        </MetricGroup>

      </div>

      <FloatingActionButton onClick={() => setShowImport(true)} title={t('statistics:importTrades', { defaultValue: 'Importer des trades' })} />
      <ImportTradesModal 
        open={showImport} 
        onClose={(done) => {
          setShowImport(false);
          if (done) {
            // Recharger les statistiques après un import réussi
            reloadStatistics();
          }
        }} 
      />
    </div>
  );
}

export default StatisticsPage;
