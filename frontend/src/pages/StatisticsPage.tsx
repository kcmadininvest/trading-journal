import React, { useState, useEffect, useMemo } from 'react';
import { useStatistics, useAnalytics, useTradesUpdateInvalidation } from '../hooks/useStatistics';
import { useTradingAccounts } from '../hooks/useStatistics';
import { formatCurrency } from '../utils/formatCurrency';
import Tooltip from '../components/ui/Tooltip';
import { TradingAccountSelector } from '../components/TradingAccount/TradingAccountSelector';
import { TradingAccount } from '../services/tradingAccounts';
import { StatisticsPageSkeleton } from '../components/ui/StatisticsPageSkeleton';
import { currenciesService, Currency } from '../services/currencies';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { usePreferences } from '../hooks/usePreferences';
import { CustomSelect } from '../components/common/CustomSelect';
import { getMonthNames } from '../utils/dateFormat';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';

function StatisticsPage() {
  const { t } = useI18nTranslation();
  const { preferences, loading: preferencesLoading } = usePreferences();
  const { selectedAccountId, setSelectedAccountId } = useTradingAccount();
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  
  // Hooks pour les données
  const { data: accounts, isLoading: accountsLoading } = useTradingAccounts();
  const { data: statisticsData, isLoading: statisticsLoading, error: statisticsError } = useStatistics(selectedAccountId, selectedYear, selectedMonth);
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useAnalytics(selectedAccountId, selectedYear, selectedMonth);
  
  // Fonction pour recharger les statistiques après un import
  const reloadStatistics = () => {
    // Forcer le rechargement en modifiant temporairement selectedYear puis en le remettant
    // Cela déclenchera le useEffect des hooks useStatistics et useAnalytics
    const currentYear = selectedYear;
    const currentMonth = selectedMonth;
    setSelectedYear(null);
    setSelectedMonth(null);
    // Remettre les valeurs originales au prochain cycle de rendu
    setTimeout(() => {
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
    }, 0);
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
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const yearOptions = useMemo(() => [
    { value: null, label: t('statistics:allYears') },
    ...availableYears.map(year => ({ value: year, label: year.toString() }))
  ], [availableYears, t]);
  
  // Utiliser les noms de mois traduits
  const monthNames = useMemo(() => getMonthNames(preferences.language), [preferences.language]);
  const monthOptions = useMemo(() => {
    const availableMonths = monthNames.map((name, index) => ({ value: index + 1, label: name }));
    return [
      { value: null, label: t('statistics:allMonths') },
      ...availableMonths.map(month => ({ value: month.value, label: month.label }))
    ];
  }, [monthNames, t]);
  
  // Gérer l'invalidation des queries quand les trades sont mis à jour
  useTradesUpdateInvalidation();
  
  // États de chargement
  // Inclure preferencesLoading pour éviter d'afficher le skeleton avant que le thème soit chargé
  const isLoading = preferencesLoading || accountsLoading || statisticsLoading || analyticsLoading;
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
  
  // Fonctions utilitaires
  const formatVolume = (volume: string) => {
    if (!volume) return 'N/A';
    const num = parseFloat(volume);
    
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else if (num >= 1) {
      return num.toFixed(0);
    } else {
      return num.toFixed(2);
    }
  };
  
  const formatRatio = (ratio: number) => {
    const absRatio = Math.abs(ratio);
    
    if (absRatio >= 1) {
      return ratio.toFixed(2);
    } else if (absRatio >= 0.01) {
      return ratio.toFixed(4);
    } else {
      return ratio.toFixed(6);
    }
  };

  const formatNumber = (value: number) => {
    return value.toFixed(2);
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="w-full">
        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('statistics:year')}
              </label>
              <CustomSelect
                value={selectedYear}
                onChange={(value) => setSelectedYear(value as number | null)}
                options={yearOptions}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('statistics:month')}
              </label>
              <CustomSelect
                value={selectedMonth}
                onChange={(value) => setSelectedMonth(value as number | null)}
                options={monthOptions}
                disabled={!selectedYear}
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedYear(null);
                  setSelectedMonth(null);
                }}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('statistics:reset')}
              </button>
            </div>
          </div>
        </div>

        {/* Section 1: Vue d'overview */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('statistics:overview.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400">{t('statistics:overview.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Statistiques générales */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500 dark:text-gray-400">{t('statistics:overview.generalStatistics')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.totalTrades')}</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {statisticsData?.total_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.winRate')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {statisticsData ? `${statisticsData.win_rate.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.totalPnL')}</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_pnl), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Gains totaux vs Pertes totales */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500 dark:text-gray-400">{t('statistics:overview.gainsVsLosses')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.totalGains')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_gains), currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.totalLosses')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_losses), currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.net')}</span>
                  <span className={`text-base font-semibold ${statisticsData && parseFloat(statisticsData.total_pnl) >= 0 ? 'text-blue-500 dark:text-blue-400' : 'text-pink-500 dark:text-pink-400'}`}>
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_pnl), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance et coûts */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500 dark:text-gray-400">{t('statistics:overview.performanceAndCosts')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.averagePnL')}</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.average_pnl), currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.totalFees')}</span>
                  <span className="text-base font-semibold text-orange-600 dark:text-orange-400">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_fees), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Volume et durée */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500 dark:text-gray-400">{t('statistics:overview.volumeAndDuration')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.totalVolume')}</span>
                  <span className="text-base font-semibold text-cyan-600 dark:text-cyan-400">
                    {statisticsData ? formatVolume(statisticsData.total_volume) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:overview.averageDuration')}</span>
                  <span className="text-base font-semibold text-cyan-600 dark:text-cyan-400">
                    {statisticsData ? statisticsData.average_duration : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Ratios de Performance */}
        {statisticsData && (
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('statistics:performanceRatios.title')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('statistics:performanceRatios.subtitle')}</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
              {/* Ratios de Performance Principaux */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.mainPerformance')}</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.profitFactor')}</span>
                      <Tooltip 
                        content={t('statistics:performanceRatios.profitFactorTooltip')}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.profit_factor >= 1.0 ? 'text-blue-500 dark:text-blue-400' : 'text-pink-500 dark:text-pink-400'}`}>
                      {statisticsData.profit_factor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.winLossRatio')}</span>
                      <Tooltip 
                        content={t('statistics:performanceRatios.winLossRatioTooltip')}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.win_loss_ratio >= 1.0 ? 'text-blue-500 dark:text-blue-400' : 'text-pink-500 dark:text-pink-400'}`}>
                      {statisticsData.win_loss_ratio.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios de Récupération */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.recovery')}</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.recoveryRatio')}</span>
                      <Tooltip 
                        content={t('statistics:performanceRatios.recoveryRatioTooltip')}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.recovery_ratio >= 1.0 ? 'text-blue-500 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {statisticsData.recovery_ratio.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.pnlPerTrade')}</span>
                      <Tooltip 
                        content={t('statistics:performanceRatios.pnlPerTradeTooltip')}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.pnl_per_trade >= 0 ? 'text-blue-500 dark:text-blue-400' : 'text-pink-500 dark:text-pink-400'}`}>
                      {formatCurrency(statisticsData.pnl_per_trade, currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios Financiers */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.financialEfficiency')}</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.feesRatio')}</span>
                      <Tooltip 
                        content={t('statistics:performanceRatios.feesRatioTooltip')}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.fees_ratio <= 0.1 ? 'text-blue-500 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {(statisticsData.fees_ratio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.volumePnLRatio')}</span>
                      <Tooltip 
                        content={t('statistics:performanceRatios.volumePnLRatioTooltip')}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {formatRatio(statisticsData.volume_pnl_ratio)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios Temporels */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.temporalAnalysis')}</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.frequency')}</span>
                      <Tooltip 
                        content={t('statistics:performanceRatios.frequencyTooltip')}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className="text-base font-semibold text-cyan-600 dark:text-cyan-400">
                      {statisticsData.frequency_ratio.toFixed(1)} {t('statistics:performanceRatios.tradesPerDay')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('statistics:performanceRatios.durationRatio')}</span>
                      <Tooltip 
                        content={t('statistics:performanceRatios.durationRatioTooltip')}
                      >
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.duration_ratio >= 1.0 ? 'text-blue-500 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {statisticsData.duration_ratio.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Analyse des Trades */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('statistics:tradesAnalysis.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400">{t('statistics:tradesAnalysis.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Trades gagnants */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">{t('statistics:tradesAnalysis.winningTrades')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:tradesAnalysis.count')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {statisticsData?.winning_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:tradesAnalysis.bestTrade')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.best_trade), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades perdants */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-pink-500 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">{t('statistics:tradesAnalysis.losingTrades')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:tradesAnalysis.count')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {statisticsData?.losing_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:tradesAnalysis.worstTrade')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.worst_trade), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Analyses Avancées */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('statistics:advancedAnalysis.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400">{t('statistics:advancedAnalysis.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Gains quotidiens */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">{t('statistics:advancedAnalysis.dailyGains')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.average')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.avg_gain_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.median')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.median_gain_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.maximum')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.max_gain_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pertes quotidiennes */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-pink-500 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">{t('statistics:advancedAnalysis.dailyLosses')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.average')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.avg_loss_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.median')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.median_loss_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.maximum')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.max_loss_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades par jour */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">{t('statistics:advancedAnalysis.tradesPerDay')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.average')}</span>
                  <span className="text-base font-semibold text-purple-600 dark:text-purple-400">
                    {analyticsData?.daily_stats ? formatNumber(analyticsData.daily_stats.avg_trades_per_day) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.median')}</span>
                  <span className="text-base font-semibold text-purple-600 dark:text-purple-400">
                    {analyticsData?.daily_stats ? formatNumber(analyticsData.daily_stats.median_trades_per_day) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades individuels */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">{t('statistics:advancedAnalysis.individualTrades')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.maxGain')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.max_gain_per_trade, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.maxLoss')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.max_loss_per_trade, currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Séquences par jour */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">{t('statistics:advancedAnalysis.dailySequences')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.consecutiveGains')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_wins_per_day : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.consecutiveLosses')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_losses_per_day : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Séquences globales */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">{t('statistics:advancedAnalysis.globalSequences')}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.consecutiveGains')}</span>
                  <span className="text-base font-semibold text-blue-500 dark:text-blue-400">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_wins : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('statistics:advancedAnalysis.consecutiveLosses')}</span>
                  <span className="text-base font-semibold text-pink-500 dark:text-pink-400">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_losses : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
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
