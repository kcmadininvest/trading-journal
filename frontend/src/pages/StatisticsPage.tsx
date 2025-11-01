import React, { useState, useEffect, useMemo } from 'react';
import { useStatistics, useAnalytics, useTradesUpdateInvalidation } from '../hooks/useStatistics';
import { useTradingAccounts } from '../hooks/useStatistics';
import { formatCurrency } from '../utils/formatCurrency';
import Tooltip from '../components/ui/Tooltip';
import { TradingAccountSelector } from '../components/TradingAccount/TradingAccountSelector';
import { TradingAccount } from '../services/tradingAccounts';
import { StatisticsPageSkeleton } from '../components/ui/StatisticsPageSkeleton';
import { currenciesService, Currency } from '../services/currencies';

function StatisticsPage() {
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  
  // Hooks pour les données
  const { data: accounts, isLoading: accountsLoading } = useTradingAccounts();
  const { data: statisticsData, isLoading: statisticsLoading, error: statisticsError } = useStatistics(selectedAccount?.id);
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useAnalytics(selectedAccount?.id);
  
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
  
  // Gérer l'invalidation des queries quand les trades sont mis à jour
  useTradesUpdateInvalidation();
  
  // États de chargement
  const isLoading = accountsLoading || statisticsLoading || analyticsLoading;
  const hasError = statisticsError || analyticsError;
  
  // Sélection automatique du compte par défaut
  React.useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccount) {
      const defaultAccount = accounts.find(acc => acc.is_default) || accounts[0];
      setSelectedAccount(defaultAccount);
    }
  }, [accounts, selectedAccount]);
  
  // Gestion des erreurs
  if (hasError) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center py-12">
          <div className="text-red-500 text-lg mb-4">Erreur lors du chargement des données</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Réessayer
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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* Sélecteur de compte de trading */}
        <div className="mb-6">
          <TradingAccountSelector
            selectedAccountId={selectedAccount?.id}
            onAccountChange={setSelectedAccount}
          />
        </div>

        {/* Section 1: Vue d'overview */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Vue d'ensemble</h2>
            <p className="text-gray-600">Statistiques générales et performance globale</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Statistiques générales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Statistiques Générales</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Total trades</span>
                  <span className="text-base font-semibold text-gray-900">
                    {statisticsData?.total_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Taux de réussite</span>
                  <span className="text-base font-semibold text-blue-500">
                    {statisticsData ? `${statisticsData.win_rate.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">P/L total</span>
                  <span className="text-base font-semibold text-gray-900">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_pnl), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Gains totaux vs Pertes totales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Gains vs Pertes</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gains totaux</span>
                  <span className="text-base font-semibold text-blue-500">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_gains), currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pertes totales</span>
                  <span className="text-base font-semibold text-pink-500">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_losses), currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Net</span>
                  <span className={`text-base font-semibold ${statisticsData && parseFloat(statisticsData.total_pnl) >= 0 ? 'text-blue-500' : 'text-pink-500'}`}>
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_pnl), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance et coûts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Performance & Coûts</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">P/L moyen</span>
                  <span className="text-base font-semibold text-gray-900">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.average_pnl), currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Frais totaux</span>
                  <span className="text-base font-semibold text-orange-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_fees), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Volume et durée */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Volume & Durée</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Volume total</span>
                  <span className="text-base font-semibold text-cyan-600">
                    {statisticsData ? formatVolume(statisticsData.total_volume) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Durée moyenne</span>
                  <span className="text-base font-semibold text-cyan-600">
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Ratios de Performance</h2>
              <p className="text-gray-600">Métriques avancées pour analyser votre stratégie de trading</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
              {/* Ratios de Performance Principaux */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500">Performance Principale</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Profit Factor</span>
                      <Tooltip 
                        content="Ratio entre les gains totaux et les pertes totales. > 1.0 = profitable, > 2.0 = excellent"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.profit_factor >= 1.0 ? 'text-blue-500' : 'text-pink-500'}`}>
                      {statisticsData.profit_factor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Win/Loss Ratio</span>
                      <Tooltip 
                        content="Ratio entre le nombre de trades gagnants et perdants. > 1.0 = plus de gains que de pertes"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.win_loss_ratio >= 1.0 ? 'text-blue-500' : 'text-pink-500'}`}>
                      {statisticsData.win_loss_ratio.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios de Récupération */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500">Récupération</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Ratio Récupération</span>
                      <Tooltip 
                        content="Ratio entre le meilleur trade et la pire perte. > 1.0 = le meilleur gain couvre la pire perte"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.recovery_ratio >= 1.0 ? 'text-blue-500' : 'text-orange-600'}`}>
                      {statisticsData.recovery_ratio.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">P/L par Trade</span>
                      <Tooltip 
                        content="Gain ou perte moyen par trade. Indique la rentabilité moyenne de chaque opération"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.pnl_per_trade >= 0 ? 'text-blue-500' : 'text-pink-500'}`}>
                      {formatCurrency(statisticsData.pnl_per_trade, currencySymbol)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios Financiers */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500">Efficacité Financière</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Ratio Frais</span>
                      <Tooltip 
                        content="Pourcentage des frais par rapport au P/L total. < 10% = frais raisonnables, > 20% = frais élevés"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.fees_ratio <= 0.1 ? 'text-blue-500' : 'text-orange-600'}`}>
                      {(statisticsData.fees_ratio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Volume/P/L</span>
                      <Tooltip 
                        content="Efficacité du trading par unité de volume. Plus élevé = meilleure efficacité de capital"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className="text-base font-semibold text-gray-900">
                      {formatRatio(statisticsData.volume_pnl_ratio)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios Temporels */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500">Analyse Temporelle</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Fréquence</span>
                      <Tooltip 
                        content="Nombre moyen de trades par jour de trading. Indique l'activité et le style de trading"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className="text-base font-semibold text-cyan-600">
                      {statisticsData.frequency_ratio.toFixed(1)} trades/jour
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Ratio Durée</span>
                      <Tooltip 
                        content="Ratio entre la durée moyenne des trades gagnants et perdants. > 1.0 = les trades gagnants durent plus longtemps que les perdants"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.duration_ratio >= 1.0 ? 'text-blue-500' : 'text-orange-600'}`}>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyse des Trades</h2>
            <p className="text-gray-600">Détail des trades gagnants et perdants</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Trades gagnants */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Gagnants</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Nombre</span>
                  <span className="text-base font-semibold text-blue-500">
                    {statisticsData?.winning_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Meilleur trade</span>
                  <span className="text-base font-semibold text-blue-500">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.best_trade), currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades perdants */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Perdants</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Nombre</span>
                  <span className="text-base font-semibold text-pink-500">
                    {statisticsData?.losing_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pire trade</span>
                  <span className="text-base font-semibold text-pink-500">
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyses Avancées</h2>
            <p className="text-gray-600">Métriques détaillées et analyses comportementales</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Gains quotidiens */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Gains Quotidiens</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moyenne</span>
                  <span className="text-base font-semibold text-blue-500">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.avg_gain_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médiane</span>
                  <span className="text-base font-semibold text-blue-500">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.median_gain_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Maximum</span>
                  <span className="text-base font-semibold text-blue-500">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.max_gain_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pertes quotidiennes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Pertes Quotidiennes</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moyenne</span>
                  <span className="text-base font-semibold text-pink-500">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.avg_loss_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médiane</span>
                  <span className="text-base font-semibold text-pink-500">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.median_loss_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Maximum</span>
                  <span className="text-base font-semibold text-pink-500">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.max_loss_per_day, currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades par jour */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades par Jour</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moyenne</span>
                  <span className="text-base font-semibold text-purple-600">
                    {analyticsData?.daily_stats ? formatNumber(analyticsData.daily_stats.avg_trades_per_day) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médiane</span>
                  <span className="text-base font-semibold text-purple-600">
                    {analyticsData?.daily_stats ? formatNumber(analyticsData.daily_stats.median_trades_per_day) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades individuels */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Individuels</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gain max</span>
                  <span className="text-base font-semibold text-blue-500">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.max_gain_per_trade, currencySymbol) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Perte max</span>
                  <span className="text-base font-semibold text-pink-500">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.max_loss_per_trade, currencySymbol) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Séquences par jour */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Séquences Quotidiennes</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gains consécutifs</span>
                  <span className="text-base font-semibold text-blue-500">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_wins_per_day : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pertes consécutives</span>
                  <span className="text-base font-semibold text-pink-500">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_losses_per_day : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Séquences globales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Séquences Globales</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gains consécutifs</span>
                  <span className="text-base font-semibold text-blue-500">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_wins : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pertes consécutives</span>
                  <span className="text-base font-semibold text-pink-500">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_losses : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatisticsPage;
