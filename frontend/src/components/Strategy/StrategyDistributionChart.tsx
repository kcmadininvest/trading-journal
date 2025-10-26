import React, { useState, useEffect, useMemo } from 'react';
import { tradesService, TopStepTrade } from '../../services/trades';
import { formatCurrency } from '../../config/chartConfig';


interface StrategyData {
  strategy: string;
  count: number;
  total_pnl: number;
  win_rate: number;
  avg_pnl: number;
  max_win: number;
  max_loss: number;
}

interface StrategyDistributionChartProps {
  year?: number;
  month?: number;
  isGlobal?: boolean;
}

const StrategyDistributionChart: React.FC<StrategyDistributionChartProps> = ({ 
  year, 
  month, 
  isGlobal = false 
}) => {
  const [strategyData, setStrategyData] = useState<StrategyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  useEffect(() => {
    const fetchStrategyData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Pour l'instant, nous utilisons les données existantes
        // Dans une version future, nous pourrions créer un endpoint spécifique pour les stratégies
        const trades = await tradesService.getTrades();
        
        // Analyser les stratégies depuis les trades
        const strategyMap = new Map<string, {
          count: number;
          total_pnl: number;
          wins: number;
          max_win: number;
          max_loss: number;
        }>();

        trades.forEach((trade: TopStepTrade) => {
          // Filtrer par mois si spécifié
          if (year && month) {
            const tradeDate = new Date(trade.entered_at);
            if (tradeDate.getFullYear() !== year || tradeDate.getMonth() + 1 !== month) {
              return;
            }
          }

          const strategy = trade.strategy || 'Non spécifiée';
          const pnl = parseFloat(trade.net_pnl.toString());
          
          if (!strategyMap.has(strategy)) {
            strategyMap.set(strategy, {
              count: 0,
              total_pnl: 0,
              wins: 0,
              max_win: 0,
              max_loss: 0
            });
          }

          const strategyStats = strategyMap.get(strategy)!;
          strategyStats.count++;
          strategyStats.total_pnl += pnl;
          
          if (pnl > 0) {
            strategyStats.wins++;
            strategyStats.max_win = Math.max(strategyStats.max_win, pnl);
          } else {
            strategyStats.max_loss = Math.min(strategyStats.max_loss, pnl);
          }
        });

        // Convertir en format pour les graphiques
        const processedData: StrategyData[] = Array.from(strategyMap.entries()).map(([strategy, stats]) => ({
          strategy,
          count: stats.count,
          total_pnl: stats.total_pnl,
          win_rate: (stats.wins / stats.count) * 100,
          avg_pnl: stats.total_pnl / stats.count,
          max_win: stats.max_win,
          max_loss: stats.max_loss
        })).sort((a, b) => b.count - a.count); // Trier par nombre de trades

        setStrategyData(processedData);
      } catch (err) {
        setError('Erreur lors du chargement des données de stratégies');
        console.error('Error fetching strategy data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStrategyData();
  }, [year, month, isGlobal]);






  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-red-600">
          <p className="text-lg font-medium mb-2">Erreur de chargement</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (strategyData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium mb-2">Aucune donnée de stratégie disponible</p>
          <p className="text-sm">
            {isGlobal 
              ? 'Aucune stratégie enregistrée pour afficher la répartition globale'
              : `Aucune stratégie enregistrée pour ${monthNames[month! - 1]} ${year}`
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques des stratégies */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {strategyData.length}
            </div>
            <div className="text-sm text-gray-600">Stratégies</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {strategyData.reduce((sum, s) => sum + s.count, 0)}
            </div>
            <div className="text-sm text-gray-600">Trades Total</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${strategyData.reduce((sum, s) => sum + s.total_pnl, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(strategyData.reduce((sum, s) => sum + s.total_pnl, 0))}
            </div>
            <div className="text-sm text-gray-600">P/L Total</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {(strategyData.reduce((sum, s) => sum + s.win_rate, 0) / strategyData.length).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Win Rate Moyen</div>
          </div>
        </div>
      </div>



    </div>
  );
};

export default StrategyDistributionChart;