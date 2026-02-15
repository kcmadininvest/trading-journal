import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStatistics, useAnalytics, useTradesUpdateInvalidation } from '../hooks/useStatistics';
import { useTradingAccounts } from '../hooks/useStatistics';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { TradingAccount } from '../services/tradingAccounts';
import { StatisticsPageSkeleton } from '../components/ui/StatisticsPageSkeleton';
import { currenciesService, Currency } from '../services/currencies';
import { tradesService, TradeListItem } from '../services/trades';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { usePreferences } from '../hooks/usePreferences';
import { PeriodSelector, PeriodRange } from '../components/common/PeriodSelector';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { MetricCard, MetricItem } from '../components/statistics/MetricCard';
import { MetricGroup } from '../components/statistics/MetricGroup';
import { MetricCardWithGauge } from '../components/statistics/MetricCardWithGauge';
import { MetricGauge, GAUGE_CONFIGS } from '../components/statistics/MetricGauge';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountSummaryCard } from '../components/common/AccountSummaryCard';
import { useDashboardData } from '../hooks/useDashboardData';
import { ExportButton } from '../components/exports';

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

  const { summaryStartDate, summaryEndDate } = useMemo(() => {
    if (selectedPeriod) {
      return { summaryStartDate: selectedPeriod.start, summaryEndDate: selectedPeriod.end };
    }
    if (selectedYear) {
      if (selectedMonth) {
        const lastDay = new Date(selectedYear, selectedMonth, 0);
        const year = lastDay.getFullYear();
        const month = String(selectedMonth).padStart(2, '0');
        const day = String(lastDay.getDate()).padStart(2, '0');
        return {
          summaryStartDate: `${selectedYear}-${month}-01`,
          summaryEndDate: `${year}-${month}-${day}`,
        };
      }
      return {
        summaryStartDate: `${selectedYear}-01-01`,
        summaryEndDate: `${selectedYear}-12-31`,
      };
    }
    return { summaryStartDate: undefined, summaryEndDate: undefined };
  }, [selectedPeriod, selectedYear, selectedMonth]);

  const { data: dashboardSummary, isLoading: summaryLoading, error: summaryError } = useDashboardData({
    accountId: selectedAccountId,
    startDate: summaryStartDate,
    endDate: summaryEndDate,
    loading: accountLoading,
  });
  
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
    activeDays: dashboardSummary?.active_days,
  });

  // Calculer le coût médian d'un trade
  const medianTradeCost = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return 0;
    
    // Calculer le coût total (fees + commissions) pour chaque trade
    const costs = filteredTrades
      .map(trade => {
        const fees = trade.fees ? parseFloat(trade.fees) : 0;
        const commissions = trade.commissions ? parseFloat(trade.commissions) : 0;
        return fees + commissions;
      })
      .filter(cost => cost > 0) // Filtrer les coûts valides
      .sort((a, b) => a - b);
    
    if (costs.length === 0) return 0;
    
    // Calculer la médiane
    const n = costs.length;
    if (n % 2 === 0) {
      return (costs[n / 2 - 1] + costs[n / 2]) / 2;
    } else {
      return costs[Math.floor(n / 2)];
    }
  }, [filteredTrades]);

  // Calculer les statistiques de points à partir des trades filtrés
  const pointsStats = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return null;

    const calcPts = (t: TradeListItem): number | null => {
      if (!t.entry_price || !t.exit_price) return null;
      const entry = parseFloat(t.entry_price);
      const exit = parseFloat(t.exit_price);
      if (isNaN(entry) || isNaN(exit)) return null;
      return t.trade_type === 'Long' ? exit - entry : entry - exit;
    };

    const allPts = filteredTrades.map(calcPts).filter((p): p is number => p !== null);
    if (allPts.length === 0) return null;

    const winPts = allPts.filter(p => p > 0);
    const losePts = allPts.filter(p => p < 0);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      avgPointsPerTrade: avg(allPts),
      avgPointsWin: avg(winPts),
      avgPointsLoss: avg(losePts),
      maxPointsGain: allPts.length > 0 ? Math.max(...allPts) : 0,
      maxPointsLoss: allPts.length > 0 ? Math.min(...allPts) : 0,
      totalPoints: allPts.reduce((a, b) => a + b, 0),
      tradesWithPoints: allPts.length,
    };
  }, [filteredTrades]);

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
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 bg-gray-50 dark:bg-gray-900">
        <div className="text-center py-8 sm:py-12">
          <div className="text-sm sm:text-base lg:text-lg text-red-500 dark:text-red-400 mb-3 sm:mb-4">{t('statistics:errorLoadingData')}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700"
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
    <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="w-full">
        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 flex-1">
              {/* Compte de trading */}
              <div className="flex-shrink-0 max-w-sm">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('statistics:tradingAccount')}
                </label>
                <AccountSelector
                  value={selectedAccountId}
                  onChange={(accountId) => {
                    setSelectedAccountId(accountId);
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
            
            {/* Bouton d'export */}
            {selectedAccount && (
              <div className="flex-shrink-0 lg:self-end">
                <ExportButton
                  tradingAccountId={selectedAccount.id}
                  tradingAccountName={selectedAccount.name}
                />
              </div>
            )}
          </div>
        </div>

        {/* Soldes du compte */}
        {selectedAccount && (
          <AccountSummaryCard 
            className="mb-4 sm:mb-6"
            indicators={indicators} 
            currencySymbol={currencySymbol} 
            loading={isLoading || summaryLoading}
            error={hasError ? t('statistics:errorLoadingData') : summaryError}
          />
        )}

        {/* Niveau 1: Hero Metrics - KPIs Principaux */}
        {statisticsData && (
          <div className="mb-4 sm:mb-6">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('statistics:overview.title')}</h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('statistics:overview.subtitle')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                  tooltip={t('statistics:overview.totalPnLTooltip')}
                  variant={parseFloat(statisticsData.total_pnl) >= 0 ? 'success' : 'danger'}
                />
                <div className="mt-4">
                  <MetricGauge
                    label={t('statistics:overview.winRate')}
                    value={statisticsData.win_rate}
                    config={GAUGE_CONFIGS.winRate}
                    tooltip={t('statistics:overview.winRateTooltip')}
                    formatValue={(val: number) => `${formatNumber(val, 1)}%`}
                    showLabels={true}
                    size="md"
                  />
                </div>
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
                  variant="danger"
                />
                <MetricItem
                  label={t('statistics:performanceRatios.maxRunupGlobal', { defaultValue: 'Max Run-up Global' })}
                  value={`${formatNumber(statisticsData.max_runup_global_pct, 2)}% (${formatCurrency(statisticsData.max_runup_global, currencySymbol)})`}
                  tooltip={t('statistics:performanceRatios.maxRunupTooltip', { defaultValue: 'Plus grande hausse depuis un point bas' })}
                  variant="success"
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
                <div className="grid grid-cols-2 gap-1 sm:gap-2">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('statistics:overview.totalTrades')}</span>
                    <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">{statisticsData.total_trades || 0}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('statistics:overview.totalVolume')}</span>
                    <span className="text-sm sm:text-base font-semibold text-blue-500 dark:text-blue-400">{formatVolume(statisticsData.total_volume)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 sm:gap-2">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('statistics:tradesAnalysis.winningTrades', { defaultValue: 'Gagnants' })}</span>
                    <span className="text-sm sm:text-base font-semibold text-blue-500 dark:text-blue-400">{statisticsData.winning_trades}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('statistics:tradesAnalysis.losingTrades', { defaultValue: 'Perdants' })}</span>
                    <span className="text-sm sm:text-base font-semibold text-pink-500 dark:text-pink-400">{statisticsData.losing_trades}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('statistics:tradesAnalysis.breakEvenShort', { defaultValue: 'BE' })}</span>
                    <span className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-300">{statisticsData.break_even_trades || 0}</span>
                  </div>
                </div>
              </MetricCard>
            </div>
          </div>
        )}

        {/* Niveau 2: Sections Thématiques */}
        {statisticsData && (
          <>
            {/* Section Performance & Risque */}
            <div className="mb-6 sm:mb-8">
              <div className="mb-3 sm:mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {t('statistics:performanceRatios.performance', { defaultValue: 'Performance' })} & {t('statistics:performanceRatios.riskManagement', { defaultValue: 'Gestion du Risque' })}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {t('statistics:performanceRatios.performanceSubtitle', { defaultValue: 'Métriques de performance globale' })} • {t('statistics:performanceRatios.riskManagementSubtitle', { defaultValue: 'Indicateurs de risque et récupération' })}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <MetricCard
                  title={t('statistics:performanceRatios.mainPerformance')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:performanceRatios.expectancy')}
                    value={formatCurrency(statisticsData.expectancy, currencySymbol)}
                    tooltip={t('statistics:performanceRatios.expectancyTooltip')}
                    variant={statisticsData.expectancy >= 0 ? 'success' : 'danger'}
                  />
                  <div className="mt-4 space-y-4">
                    <MetricGauge
                      label={t('statistics:performanceRatios.profitFactor')}
                      value={statisticsData.profit_factor}
                      config={GAUGE_CONFIGS.profitFactor}
                      tooltip={t('statistics:performanceRatios.profitFactorTooltip')}
                      formatValue={(val: number) => formatNumber(val, 2)}
                      showLabels={false}
                      size="md"
                    />
                    <MetricGauge
                      label={t('statistics:performanceRatios.winLossRatio')}
                      value={statisticsData.win_loss_ratio}
                      config={GAUGE_CONFIGS.winLossRatio}
                      tooltip={t('statistics:performanceRatios.winLossRatioTooltip')}
                      formatValue={(val: number) => formatNumber(val, 2)}
                      showLabels={true}
                      size="md"
                    />
                  </div>
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
                    label={t('statistics:performanceRatios.volumePnLRatio')}
                    value={formatRatio(statisticsData.volume_pnl_ratio)}
                    tooltip={t('statistics:performanceRatios.volumePnLRatioTooltip')}
                    variant="default"
                  />
                  <div className="mt-4 space-y-4">
                    <MetricGauge
                      label={t('statistics:performanceRatios.feesRatio')}
                      value={statisticsData.fees_ratio * 100}
                      config={GAUGE_CONFIGS.feesRatio}
                      tooltip={t('statistics:performanceRatios.feesRatioTooltip')}
                      formatValue={(val: number) => `${formatNumber(val, 1)}%`}
                      showLabels={false}
                      size="md"
                    />
                    <MetricGauge
                      label={t('statistics:performanceRatios.tradeEfficiency')}
                      value={statisticsData.trade_efficiency}
                      config={GAUGE_CONFIGS.tradeEfficiency}
                      tooltip={t('statistics:performanceRatios.tradeEfficiencyTooltip')}
                      formatValue={(val: number) => `${formatNumber(val, 1)}%`}
                      showLabels={true}
                      size="md"
                    />
                  </div>
                </MetricCard>

                <MetricCardWithGauge
                  title={t('statistics:performanceRatios.riskAdjustedPerformance')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                  metrics={[
                    {
                      label: t('statistics:performanceRatios.sharpeRatio'),
                      value: statisticsData.sharpe_ratio,
                      config: GAUGE_CONFIGS.sharpeRatio,
                      tooltip: t('statistics:performanceRatios.sharpeRatioTooltip'),
                      formatValue: (val) => formatNumber(val, 2),
                      showLabels: false,
                    },
                    {
                      label: t('statistics:performanceRatios.sortinoRatio'),
                      value: statisticsData.sortino_ratio,
                      config: GAUGE_CONFIGS.sharpeRatio,
                      tooltip: t('statistics:performanceRatios.sortinoRatioTooltip'),
                      formatValue: (val) => formatNumber(val, 2),
                      showLabels: false,
                    },
                    {
                      label: t('statistics:performanceRatios.calmarRatio'),
                      value: statisticsData.calmar_ratio,
                      config: GAUGE_CONFIGS.sharpeRatio,
                      tooltip: t('statistics:performanceRatios.calmarRatioTooltip'),
                      formatValue: (val) => formatNumber(val, 2),
                      showLabels: true,
                    },
                  ]}
                />

                <MetricCard
                  title={t('statistics:performanceRatios.recovery')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  }
                >
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
                  <div className="mt-4">
                    <MetricGauge
                      label={t('statistics:performanceRatios.recoveryRatio')}
                      value={statisticsData.recovery_ratio}
                      config={GAUGE_CONFIGS.recoveryRatio}
                      tooltip={t('statistics:performanceRatios.recoveryRatioTooltip')}
                      formatValue={(val: number) => formatNumber(val, 2)}
                      showLabels={true}
                      size="md"
                    />
                  </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {statisticsData && (
              <>
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

                {pointsStats && (
                  <MetricCard
                    title={t('statistics:tradesAnalysis.avgPoints', { defaultValue: 'Points Moyens' })}
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    }
                  >
                    <MetricItem
                      label={t('statistics:tradesAnalysis.avgPointsPerTrade', { defaultValue: 'Moy. points / trade' })}
                      value={`${pointsStats.avgPointsPerTrade >= 0 ? '+' : ''}${formatNumber(pointsStats.avgPointsPerTrade, 2)} pts`}
                      tooltip={t('statistics:tradesAnalysis.avgPointsPerTradeTooltip', { defaultValue: 'Nombre moyen de points gagnés ou perdus par trade (indépendant de la taille de position)' })}
                      variant={pointsStats.avgPointsPerTrade >= 0 ? 'success' : 'danger'}
                    />
                    <MetricItem
                      label={t('statistics:tradesAnalysis.avgPointsWin', { defaultValue: 'Moy. points gagnants' })}
                      value={pointsStats.avgPointsWin > 0 ? `+${formatNumber(pointsStats.avgPointsWin, 2)} pts` : 'N/A'}
                      tooltip={t('statistics:tradesAnalysis.avgPointsWinTooltip', { defaultValue: 'Points moyens captés sur les trades gagnants' })}
                      variant="success"
                    />
                    <MetricItem
                      label={t('statistics:tradesAnalysis.avgPointsLoss', { defaultValue: 'Moy. points perdants' })}
                      value={pointsStats.avgPointsLoss < 0 ? `${formatNumber(pointsStats.avgPointsLoss, 2)} pts` : 'N/A'}
                      tooltip={t('statistics:tradesAnalysis.avgPointsLossTooltip', { defaultValue: 'Points moyens perdus sur les trades perdants' })}
                      variant="danger"
                    />
                  </MetricCard>
                )}

                {pointsStats && (
                  <MetricCard
                    title={t('statistics:tradesAnalysis.extremePoints', { defaultValue: 'Points Extrêmes' })}
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    }
                  >
                    <MetricItem
                      label={t('statistics:tradesAnalysis.maxPointsGain', { defaultValue: 'Max points gagnés' })}
                      value={`+${formatNumber(pointsStats.maxPointsGain, 2)} pts`}
                      variant="success"
                    />
                    <MetricItem
                      label={t('statistics:tradesAnalysis.maxPointsLoss', { defaultValue: 'Max points perdus' })}
                      value={`${formatNumber(pointsStats.maxPointsLoss, 2)} pts`}
                      variant="danger"
                    />
                  </MetricCard>
                )}

                <MetricCard
                  title={t('statistics:tradesAnalysis.averageAndMedianTradeCost')}
                  icon={
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                >
                  <MetricItem
                    label={t('statistics:tradesAnalysis.averageCostPerTrade')}
                    value={
                      statisticsData.total_trades > 0
                        ? formatCurrency(parseFloat(statisticsData.total_fees) / statisticsData.total_trades, currencySymbol)
                        : formatCurrency(0, currencySymbol)
                    }
                    tooltip={t('statistics:tradesAnalysis.averageTradeCostTooltip')}
                    variant="info"
                  />
                  <MetricItem
                    label={t('statistics:tradesAnalysis.medianCostPerTrade', { defaultValue: 'Coût médian par trade' })}
                    value={formatCurrency(medianTradeCost, currencySymbol)}
                    tooltip={t('statistics:tradesAnalysis.medianCostPerTradeTooltip', { defaultValue: 'Coût médian par trade (fees + commissions)' })}
                    variant="info"
                  />
                </MetricCard>

                {analyticsData?.trade_type_stats && (
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
                )}
              </>
            )}
          </div>
        </MetricGroup>

        <MetricGroup
          title={t('statistics:advancedAnalysis.title')}
          subtitle={t('statistics:advancedAnalysis.subtitle')}
          defaultCollapsed={false}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
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

              </>
            )}
          </div>
        </MetricGroup>

        {/* Section Risk/Reward Ratio */}
        {statisticsData && (
          <div className="mb-6 sm:mb-8">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {t('statistics:riskReward.title', { defaultValue: 'Risk/Reward Ratio' })}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {t('statistics:riskReward.subtitle', { defaultValue: 'Analyse du ratio risque/récompense prévu vs réel' })}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <MetricCard
                title={t('statistics:riskReward.plannedRR', { defaultValue: 'R:R Prévu' })}
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                <MetricItem
                  label={t('statistics:riskReward.averagePlannedRR', { defaultValue: 'R:R moyen prévu' })}
                  value={statisticsData.avg_planned_rr > 0 ? `1:${formatNumber(statisticsData.avg_planned_rr, 3)}` : '—'}
                  tooltip={t('statistics:riskReward.averagePlannedRRTooltip', { defaultValue: 'Ratio Risk/Reward moyen prévu à l\'entrée des trades' })}
                  variant={statisticsData.avg_planned_rr >= 2.0 ? 'success' : statisticsData.avg_planned_rr >= 1.5 ? 'warning' : 'default'}
                />
                <MetricItem
                  label={t('statistics:riskReward.tradesWithPlannedRR', { defaultValue: 'Trades avec R:R prévu' })}
                  value={`${statisticsData.trades_with_planned_rr} / ${statisticsData.total_trades}`}
                  tooltip={t('statistics:riskReward.tradesWithPlannedRRTooltip', { defaultValue: 'Nombre de trades ayant un R:R prévu défini' })}
                  variant="default"
                />
              </MetricCard>

              <MetricCard
                title={t('statistics:riskReward.actualRR', { defaultValue: 'R:R Réel' })}
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
              >
                <MetricItem
                  label={t('statistics:riskReward.averageActualRR', { defaultValue: 'R:R moyen réel' })}
                  value={statisticsData.avg_actual_rr > 0 ? `1:${formatNumber(statisticsData.avg_actual_rr, 3)}` : '—'}
                  tooltip={t('statistics:riskReward.averageActualRRTooltip', { defaultValue: 'Ratio Risk/Reward moyen réel obtenu à la sortie des trades' })}
                  variant={statisticsData.avg_actual_rr >= 2.0 ? 'success' : statisticsData.avg_actual_rr >= 1.5 ? 'warning' : 'default'}
                />
                <MetricItem
                  label={t('statistics:riskReward.tradesWithActualRR', { defaultValue: 'Trades avec R:R réel' })}
                  value={`${statisticsData.trades_with_actual_rr} / ${statisticsData.total_trades}`}
                  tooltip={t('statistics:riskReward.tradesWithActualRRTooltip', { defaultValue: 'Nombre de trades ayant un R:R réel calculé' })}
                  variant="default"
                />
              </MetricCard>

              <MetricCard
                title={t('statistics:riskReward.planRespect', { defaultValue: 'Respect du Plan' })}
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                <MetricItem
                  label={t('statistics:riskReward.tradesWithBothRR', { defaultValue: 'Trades comparables' })}
                  value={statisticsData.trades_with_both_rr}
                  tooltip={t('statistics:riskReward.tradesWithBothRRTooltip', { defaultValue: 'Nombre de trades ayant à la fois un R:R prévu et un R:R réel' })}
                  variant="default"
                />
                <div className="mt-4">
                  <MetricGauge
                    label={t('statistics:riskReward.planRespectRate', { defaultValue: 'Taux de respect' })}
                    value={statisticsData.plan_respect_rate}
                    config={GAUGE_CONFIGS.planRespectRate}
                    tooltip={t('statistics:riskReward.planRespectRateTooltip', { defaultValue: 'Pourcentage de trades où le R:R réel est supérieur ou égal au R:R prévu' })}
                    formatValue={(val: number) => `${formatNumber(val, 1)}%`}
                    showLabels={true}
                    size="md"
                  />
                </div>
              </MetricCard>
            </div>
            {statisticsData.trades_with_planned_rr === 0 && statisticsData.trades_with_actual_rr === 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {t('statistics:riskReward.noDataMessage', { 
                    defaultValue: 'Aucun R:R disponible. Ajoutez un Stop Loss et un Take Profit prévu lors de la création ou modification d\'un trade pour voir les statistiques R:R.' 
                  })}
                </p>
              </div>
            )}
          </div>
        )}

      </div>

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
