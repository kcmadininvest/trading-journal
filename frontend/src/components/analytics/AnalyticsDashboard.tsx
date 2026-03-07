import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Trophy, AlertTriangle, Brain, TrendingUp, Clock } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import { EdgeAnalysis, BestSetup, WorstPattern, BehavioralBias } from '../../types/analytics';

const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  // Fonction pour traduire les biais comportementaux
  const translateBias = (biasName: string): string => {
    const biasTranslations: { [key: string]: string } = {
      'Overtrading': t('analytics:dashboard.biases.types.overtrading', { defaultValue: 'Overtrading' }),
      'Stop Loss Widening': t('analytics:dashboard.biases.types.stopLossWidening', { defaultValue: 'Stop Loss Widening' }),
      'Revenge Trading': t('analytics:dashboard.biases.types.revengeTrading', { defaultValue: 'Revenge Trading' }),
    };
    return biasTranslations[biasName] || biasName;
  };

  const translateBiasDescription = (bias: BehavioralBias): string => {
    // Overtrading
    if (bias.bias === 'Overtrading') {
      const match = bias.description.match(/Moyenne de ([\d.]+) trades/);
      if (match) {
        return t('analytics:dashboard.biases.descriptions.overtrading', { count: parseFloat(match[1]) });
      }
    }
    
    // Revenge Trading
    if (bias.bias === 'Revenge Trading') {
      const match = bias.description.match(/(\d+) trades de vengeance détectés \((\d+) dans les (\d+) min\)/);
      if (match) {
        return t('analytics:dashboard.biases.descriptions.revengeTrading', { 
          count: parseInt(match[1], 10), 
          quickCount: parseInt(match[2], 10),
          minutes: parseInt(match[3], 10)
        });
      }
    }
    
    // FOMO
    if (bias.bias === 'FOMO') {
      const match = bias.description.match(/(\d+) trades avec signes de FOMO/);
      if (match) {
        return t('analytics:dashboard.biases.descriptions.fomo', { count: parseInt(match[1], 10) });
      }
    }
    
    // Loss Aversion
    if (bias.bias === 'Loss Aversion') {
      const match = bias.description.match(/(\d+) trades perdants gardés trop longtemps/);
      if (match) {
        return t('analytics:dashboard.biases.descriptions.lossAversion', { count: parseInt(match[1], 10) });
      }
    }
    
    // Premature Exit
    if (bias.bias === 'Premature Exit') {
      const match = bias.description.match(/(\d+) trades gagnants coupés trop tôt/);
      if (match) {
        return t('analytics:dashboard.biases.descriptions.prematureExit', { count: parseInt(match[1], 10) });
      }
    }
    
    // Stop Loss Widening
    if (bias.bias === 'Stop Loss Widening') {
      const match = bias.description.match(/(\d+) trades avec SL/);
      if (match) {
        return t('analytics:dashboard.biases.descriptions.stopLossWidening', { count: parseInt(match[1], 10) });
      }
    }
    
    return bias.description;
  };

  const translateBiasRecommendation = (bias: BehavioralBias): string => {
    const recommendationTranslations: { [key: string]: string } = {
      'Limiter le nombre de trades par jour': t('analytics:dashboard.biases.recommendations.limitTrades', { defaultValue: 'Limiter le nombre de trades par jour' }),
      'Respecter le stop loss initial': t('analytics:dashboard.biases.recommendations.respectStopLoss', { defaultValue: 'Respecter le stop loss initial' }),
      'Prendre une pause après une perte. Attendre au moins 30 minutes avant le prochain trade.': t('analytics:dashboard.biases.recommendations.takePauseAfterLoss', { defaultValue: 'Prendre une pause après une perte. Attendre au moins 30 minutes avant le prochain trade.' }),
      'Attendre le bon setup. Ne pas courir après le marché.': t('analytics:dashboard.biases.recommendations.waitForSetup', { defaultValue: 'Attendre le bon setup. Ne pas courir après le marché.' }),
      'Respecter le stop loss initial. Couper les pertes rapidement.': t('analytics:dashboard.biases.recommendations.cutLossesQuickly', { defaultValue: 'Respecter le stop loss initial. Couper les pertes rapidement.' }),
      'Laisser courir les gagnants. Respecter les objectifs de take profit.': t('analytics:dashboard.biases.recommendations.letWinnersRun', { defaultValue: 'Laisser courir les gagnants. Respecter les objectifs de take profit.' }),
      'Respecter le stop loss initial. Ne jamais élargir le SL.': t('analytics:dashboard.biases.recommendations.neverWidenSL', { defaultValue: 'Respecter le stop loss initial. Ne jamais élargir le SL.' }),
    };
    return recommendationTranslations[bias.recommendation] || bias.recommendation;
  };
  const [error, setError] = useState<string | null>(null);
  const [edgeAnalysis, setEdgeAnalysis] = useState<EdgeAnalysis | null>(null);
  const [bestSetups, setBestSetups] = useState<BestSetup[]>([]);
  const [worstPatterns, setWorstPatterns] = useState<WorstPattern[]>([]);
  const [biases, setBiases] = useState<BehavioralBias[]>([]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [edge, setups, patterns, behavioralBiases] = await Promise.all([
        analyticsService.getEdgeAnalysis(),
        analyticsService.getBestSetups(30),
        analyticsService.getWorstPatterns(),
        analyticsService.getBehavioralBiases(),
      ]);

      setEdgeAnalysis(edge);
      setBestSetups(setups);
      setWorstPatterns(patterns);
      setBiases(behavioralBiases);
    } catch (err: any) {
      setError(err.message || t('analytics:dashboard.error', { defaultValue: 'Erreur lors du chargement des analyses' }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques Globales */}
      {edgeAnalysis && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            {t('analytics:dashboard.globalStats.title', { defaultValue: 'Statistiques Globales' })}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">{t('analytics:dashboard.globalStats.totalTrades', { defaultValue: 'Total Trades' })}</p>
              <p className="text-2xl font-bold text-blue-600">
                {edgeAnalysis.global_statistics.total_trades}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">{t('analytics:dashboard.globalStats.winRate', { defaultValue: 'Win Rate' })}</p>
              <p className="text-2xl font-bold text-green-600">
                {parseFloat(edgeAnalysis.global_statistics.win_rate).toFixed(1)}%
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">{t('analytics:dashboard.globalStats.expectancy', { defaultValue: 'Expectancy' })}</p>
              <p className="text-2xl font-bold text-purple-600">
                {parseFloat(edgeAnalysis.global_statistics.expectancy).toFixed(2)}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">{t('analytics:dashboard.globalStats.profitFactor', { defaultValue: 'Profit Factor' })}</p>
              <p className="text-2xl font-bold text-orange-600">
                {edgeAnalysis.global_statistics.profit_factor 
                  ? parseFloat(edgeAnalysis.global_statistics.profit_factor).toFixed(2)
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Meilleurs Setups */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-600" />
          {t('analytics:dashboard.bestSetups.title', { defaultValue: 'Meilleurs Setups' })}
        </h2>
        {bestSetups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics:dashboard.bestSetups.setup', { defaultValue: 'Setup' })}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics:dashboard.bestSetups.quality', { defaultValue: 'Qualité' })}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics:dashboard.bestSetups.sample', { defaultValue: 'Échantillon' })}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics:dashboard.bestSetups.winRate', { defaultValue: 'Win Rate' })}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics:dashboard.bestSetups.expectancy', { defaultValue: 'Expectancy' })}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics:dashboard.bestSetups.totalPnL', { defaultValue: 'PnL Total' })}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bestSetups.map((setup, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {setup.setup_category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        setup.setup_quality === 'A' ? 'bg-green-100 text-green-800' :
                        setup.setup_quality === 'B' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {setup.setup_quality}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {setup.sample_size}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                      {(setup.win_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-semibold">
                      {parseFloat(setup.expectancy).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                      <span className={parseFloat(setup.total_pnl) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {parseFloat(setup.total_pnl).toFixed(2)} €
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            {t('analytics:dashboard.bestSetups.noData', { defaultValue: 'Pas assez de données (minimum 30 trades par setup)' })}
          </p>
        )}
      </div>

      {/* Pires Patterns */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          {t('analytics:dashboard.worstPatterns.title', { defaultValue: 'Patterns à Éviter' })}
        </h2>
        {worstPatterns.length > 0 ? (
          <div className="space-y-3">
            {worstPatterns.map((pattern, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-red-800">{pattern.error}</p>
                    <p className="text-sm text-red-600 mt-1">
                      {pattern.count} {t('analytics:dashboard.worstPatterns.occurrence', { count: pattern.count, defaultValue: 'occurrence' })}{pattern.count > 1 ? 's' : ''} • 
                      {t('analytics:dashboard.worstPatterns.avgPnL', { defaultValue: 'PnL moyen' })}: <span className="font-semibold">{parseFloat(pattern.average_pnl).toFixed(2)} €</span>
                    </p>
                  </div>
                  <div className="ml-4">
                    <span className="text-2xl">🚫</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            {t('analytics:dashboard.worstPatterns.noData', { defaultValue: 'Aucun pattern perdant récurrent identifié' })}
          </p>
        )}
      </div>

      {/* Biais Comportementaux */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-600" />
          {t('analytics:dashboard.biases.title', { defaultValue: 'Biais Comportementaux Détectés' })}
        </h2>
        {biases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {biases.map((bias, index) => (
              <div key={index} className={`border rounded-lg p-4 ${
                bias.severity === 'high' ? 'bg-red-50 border-red-300' :
                bias.severity === 'medium' ? 'bg-yellow-50 border-yellow-300' :
                'bg-blue-50 border-blue-300'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-base">{translateBias(bias.bias)}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    bias.severity === 'high' ? 'bg-red-200 text-red-800' :
                    bias.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {bias.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3">{translateBiasDescription(bias)}</p>
                <div className="bg-white bg-opacity-50 rounded p-2">
                  <p className="text-xs font-medium text-gray-800 mb-1">💡 {t('analytics:dashboard.biases.recommendation', { defaultValue: 'Recommandation' })}</p>
                  <p className="text-xs text-gray-700">{translateBiasRecommendation(bias)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            {t('analytics:dashboard.biases.noData', { defaultValue: 'Aucun biais comportemental significatif détecté' })}
          </p>
        )}

      </div>

      {/* Analyse par Tendance */}
      {edgeAnalysis && edgeAnalysis.trend_analysis && edgeAnalysis.trend_analysis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            {t('analytics:dashboard.trendAnalysis.title', { defaultValue: 'Performance par Tendance' })}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {edgeAnalysis.trend_analysis.map((trend, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg capitalize mb-2">{trend.trend}</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">
                    {t('analytics:dashboard.trendAnalysis.trades', { defaultValue: 'Trades' })}: <span className="font-semibold">{trend.sample_size}</span>
                  </p>
                  <p className="text-gray-600">
                    {t('analytics:dashboard.trendAnalysis.winRate', { defaultValue: 'Win Rate' })}: <span className="font-semibold text-green-600">
                      {parseFloat(trend.win_rate).toFixed(1)}%
                    </span>
                  </p>
                  <p className="text-gray-600">
                    {t('analytics:dashboard.trendAnalysis.expectancy', { defaultValue: 'Expectancy' })}: <span className="font-semibold text-purple-600">
                      {parseFloat(trend.expectancy).toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyse par Session */}
      {edgeAnalysis && edgeAnalysis.session_analysis && edgeAnalysis.session_analysis.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" />
            {t('analytics:dashboard.sessionAnalysis.title', { defaultValue: 'Performance par Session' })}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {edgeAnalysis.session_analysis.map((session, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg capitalize mb-2">
                  {session.session.replace('_', ' ')}
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">
                    {t('analytics:dashboard.sessionAnalysis.trades', { defaultValue: 'Trades' })}: <span className="font-semibold">{session.sample_size}</span>
                  </p>
                  <p className="text-gray-600">
                    {t('analytics:dashboard.sessionAnalysis.winRate', { defaultValue: 'Win Rate' })}: <span className="font-semibold text-green-600">
                      {parseFloat(session.win_rate).toFixed(1)}%
                    </span>
                  </p>
                  <p className="text-gray-600">
                    {t('analytics:dashboard.sessionAnalysis.expectancy', { defaultValue: 'Expectancy' })}: <span className="font-semibold text-purple-600">
                      {parseFloat(session.expectancy).toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
