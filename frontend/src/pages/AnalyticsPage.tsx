import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import TooltipComponent from '../components/ui/Tooltip';
import { tradesService, TradeListItem } from '../services/trades';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar as ChartBar, Line as ChartLine, Scatter as ChartScatter } from 'react-chartjs-2';
import { usePreferences } from '../hooks/usePreferences';
import { formatCurrency as formatCurrencyUtil } from '../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler,
  ChartDataLabels
);

const AnalyticsPage: React.FC = () => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  
  // Wrapper pour formatCurrency avec préférences
  const formatCurrency = (value: number, currencySymbol: string = ''): string => {
    return formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2);
  };
  const [accountId, setAccountId] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [heatmapTooltip, setHeatmapTooltip] = useState<{
    day: string;
    hour: number;
    value: number;
    x: number;
    y: number;
  } | null>(null);
  
  const heatmapContainerRef = useRef<HTMLDivElement>(null);

  // Récupérer la liste des devises
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const currencyList = await currenciesService.list();
        setCurrencies(currencyList);
      } catch (err) {
        console.error('Erreur lors du chargement des devises', err);
      }
    };
    loadCurrencies();
  }, []);

  // Récupérer le compte sélectionné pour obtenir sa devise
  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) {
        setSelectedAccount(null);
        return;
      }
      try {
        const account = await tradingAccountsService.get(accountId);
        setSelectedAccount(account);
      } catch (err) {
        console.error('Erreur lors du chargement du compte', err);
        setSelectedAccount(null);
      }
    };
    loadAccount();
  }, [accountId]);

  // Obtenir le symbole de devise
  const currencySymbol = useMemo(() => {
    if (!selectedAccount || !currencies.length) return '';
    const currency = currencies.find(c => c.code === selectedAccount.currency);
    return currency?.symbol || '';
  }, [selectedAccount, currencies]);

  useEffect(() => {
    const loadTrades = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await tradesService.list({
          trading_account: accountId ?? undefined,
          page_size: 1000, // Récupérer beaucoup de trades pour les analyses
        });
        setTrades(response.results);
      } catch (err) {
        setError(t('analytics:errorLoadingData'));
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrades();
  }, [accountId, t]);

  // Performance par heure (nuage de points)
  const hourlyPerformanceScatter = useMemo(() => {
    const scatterData: { hour: number; pnl: number }[] = [];
    const hoursWithData = new Set<number>();
    
    trades.forEach(trade => {
      if (trade.entered_at && trade.net_pnl) {
        const date = new Date(trade.entered_at);
        const hour = date.getHours();
        const pnl = parseFloat(trade.net_pnl);
        
        scatterData.push({
          hour,
          pnl,
        });
        hoursWithData.add(hour);
      }
    });

    // Retourner les données et les heures avec des trades (pour l'axe X)
    return {
      data: scatterData,
      hoursWithData: Array.from(hoursWithData).sort((a, b) => a - b),
    };
  }, [trades]);

  // Performance par heure (barres)
  const hourlyPerformanceBars = useMemo(() => {
    const hourlyData: { [hour: number]: number } = {};
    
    trades.forEach(trade => {
      if (trade.entered_at && trade.net_pnl) {
        const date = new Date(trade.entered_at);
        const hour = date.getHours();
        const pnl = parseFloat(trade.net_pnl);
        
        hourlyData[hour] = (hourlyData[hour] || 0) + pnl;
      }
    });

    // Ne garder que les heures avec des données (pnl !== 0) pour éviter les grands espaces vides
    return Object.keys(hourlyData)
      .map(Number)
      .sort((a, b) => a - b)
      .map(hour => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        hourNum: hour, // Stocker le numéro d'heure pour référence
        pnl: hourlyData[hour] || 0,
      }));
  }, [trades]);

  // Corrélation PnL vs Nombre de Trades
  const correlationData = useMemo(() => {
    const dailyData: { [date: string]: { trades: number; pnl: number } } = {};
    
    trades.forEach(trade => {
      if (trade.trade_day && trade.net_pnl) {
        const date = trade.trade_day;
        const pnl = parseFloat(trade.net_pnl);
        
        if (!dailyData[date]) {
          dailyData[date] = { trades: 0, pnl: 0 };
        }
        dailyData[date].trades += 1;
        dailyData[date].pnl += pnl;
      }
    });

    const dataPoints = Object.values(dailyData).map(data => ({
      trades: data.trades,
      pnl: data.pnl,
    }));

    // Calculer les ticks uniques pour l'axe X
    const uniqueTrades = Array.from(new Set(dataPoints.map(d => d.trades))).sort((a, b) => a - b);
    const minTrades = uniqueTrades.length > 0 ? Math.min(...uniqueTrades) : 0;
    const maxTrades = uniqueTrades.length > 0 ? Math.max(...uniqueTrades) : 1;
    
    // Générer des ticks raisonnables (max 10-12 ticks)
    let xTicks: number[] = [];
    const range = maxTrades - minTrades;
    if (range <= 12 && uniqueTrades.length <= 12) {
      // Si peu de valeurs uniques, utiliser toutes les valeurs uniques
      xTicks = uniqueTrades;
    } else {
      // Sinon, créer des ticks espacés de manière équitable
      const step = Math.ceil(range / 10);
      for (let i = minTrades; i <= maxTrades; i += step) {
        xTicks.push(i);
      }
      if (xTicks[xTicks.length - 1] !== maxTrades) {
        xTicks.push(maxTrades);
      }
    }

    return { dataPoints, xTicks, minTrades, maxTrades };
  }, [trades]);

  // Drawdown par jour
  // Le graphique affiche l'écart entre le P/L cumulé le plus élevé (pic) et le P/L cumulé actuel au fil du temps
  const drawdownData = useMemo(() => {
    // Groupement par date : tous les trades sont groupés par date d'entrée
    const dailyData: { [date: string]: number } = {};
    
    trades.forEach(trade => {
      if (trade.trade_day && trade.net_pnl) {
        const date = trade.trade_day;
        const pnl = parseFloat(trade.net_pnl);
        // P/L journalier : somme du net_pnl pour chaque jour
        dailyData[date] = (dailyData[date] || 0) + pnl;
      }
    });

    const sortedDates = Object.keys(dailyData).sort();
    let cumulativePnl = 0; // P/L cumulé : addition progressive du P/L journalier
    let peak = 0; // Pic de performance (peak_pnl) : valeur maximale du P/L cumulé atteinte jusqu'alors
    
    const allData = sortedDates.map(date => {
      // Addition progressive du P/L journalier
      cumulativePnl += dailyData[date];
      // Mettre à jour le pic si le P/L cumulé dépasse le pic précédent
      peak = Math.max(peak, cumulativePnl);
      
      // Drawdown : différence entre le pic et le P/L cumulé actuel
      // drawdown = peak_pnl - cumulative_pnl
      // Le drawdown représente la distance depuis le pic (0 = au pic, jamais négatif)
      const drawdownAmount = cumulativePnl < peak ? peak - cumulativePnl : 0;
      const drawdownPercent = peak > 0 && cumulativePnl < peak 
        ? ((peak - cumulativePnl) / peak) * 100 
        : 0;
      
      const localeMap: Record<string, string> = {
        'fr': 'fr-FR',
        'en': 'en-US',
        'es': 'es-ES',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-PT',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'zh': 'zh-CN',
      };
      const locale = localeMap[preferences.language] || 'fr-FR';
      
      return {
        date: new Date(date).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: preferences.timezone }),
        drawdown: drawdownPercent,
        drawdownAmount: drawdownAmount,
        cumulativePnl,
      };
    });
    
    // Filtrage : affiche uniquement les jours avec drawdown > 0
    return allData.filter(data => data.drawdown > 0);
  }, [trades, preferences.timezone, preferences.language]);

  // Heatmap Jour × Heure
  const heatmapData = useMemo(() => {
    const daysOfWeek = [
      t('analytics:days.monday'),
      t('analytics:days.tuesday'),
      t('analytics:days.wednesday'),
      t('analytics:days.thursday'),
      t('analytics:days.friday'),
      t('analytics:days.saturday'),
      t('analytics:days.sunday'),
    ];
    const heatmap: { [day: number]: { [hour: number]: number } } = {};
    
    // Initialiser toutes les combinaisons
    for (let day = 0; day < 7; day++) {
      heatmap[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        heatmap[day][hour] = 0;
      }
    }
    
    trades.forEach(trade => {
      if (trade.entered_at && trade.net_pnl) {
        const date = new Date(trade.entered_at);
        const day = (date.getDay() + 6) % 7; // 0 = Lundi, 6 = Dimanche
        const hour = date.getHours();
        const pnl = parseFloat(trade.net_pnl);
        
        heatmap[day][hour] = (heatmap[day][hour] || 0) + pnl;
      }
    });

    // Calculer les min/max pour la normalisation des couleurs (optimisé)
    let maxPnl = 0;
    let minPnl = 0;
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const value = heatmap[day][hour];
        if (value > maxPnl) maxPnl = value;
        if (value < minPnl) minPnl = value;
      }
    }
    const maxAbs = Math.max(Math.abs(maxPnl), Math.abs(minPnl));

    return {
      data: heatmap,
      daysOfWeek,
      maxAbs,
      minPnl,
      maxPnl,
    };
  }, [trades, t]);

  // Distribution des PnL (histogramme)
  const pnlDistribution = useMemo(() => {
    const pnls: number[] = [];
    
    // Calculer min/max en une seule passe (optimisé)
    let minPnl = Infinity;
    let maxPnl = -Infinity;
    
    for (const trade of trades) {
      if (trade.net_pnl !== null && trade.net_pnl !== undefined) {
        const pnl = parseFloat(trade.net_pnl);
        pnls.push(pnl);
        if (pnl < minPnl) minPnl = pnl;
        if (pnl > maxPnl) maxPnl = pnl;
      }
    }

    if (pnls.length === 0) return [];

    const range = maxPnl - minPnl;
    // Bonne pratique : limiter à 10 bins maximum pour une meilleure lisibilité (recommandation : 2-10 catégories)
    const bins = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(pnls.length))));
    const binWidth = range / bins;

    const histogram: { [bin: number]: number } = {};
    for (let i = 0; i < bins; i++) {
      histogram[i] = 0;
    }

    pnls.forEach(pnl => {
      let binIndex = Math.floor((pnl - minPnl) / binWidth);
      if (binIndex === bins) binIndex = bins - 1; // Le dernier point va dans la dernière bin
      histogram[binIndex] = (histogram[binIndex] || 0) + 1;
    });

    return Array.from({ length: bins }, (_, i) => {
      const start = minPnl + i * binWidth;
      const end = minPnl + (i + 1) * binWidth;
      const midpoint = start + binWidth / 2;
      return {
        range: `${start.toFixed(0)}`,
        rangeLabel: `${start.toFixed(0)} - ${end.toFixed(0)}`,
        count: histogram[i] || 0,
        midpoint: midpoint,
        isPositive: midpoint >= 0, // Pour déterminer la couleur
        start: start, // Stocker pour les labels
        end: end, // Stocker pour les labels
        binWidth: binWidth, // Stocker pour référence
      };
    }).filter(bin => bin.count > 0); // Filtrer pour ne garder que les bins avec des données
  }, [trades]);

  // Fonction pour obtenir la couleur de la heatmap (améliorée)
  const getHeatmapColor = (value: number, maxAbs: number): string => {
    if (maxAbs === 0) return '#f3f4f6'; // Gris clair pour les valeurs nulles
    
    const normalized = value / maxAbs; // -1 à 1
    
    if (normalized > 0) {
      // Bleu pour les gains avec gradient amélioré
      const intensity = Math.min(Math.abs(normalized), 1);
      if (intensity < 0.2) return '#dbeafe'; // Bleu très clair
      if (intensity < 0.4) return '#93c5fd'; // Bleu clair
      if (intensity < 0.6) return '#60a5fa'; // Bleu moyen
      if (intensity < 0.8) return '#3b82f6'; // Bleu
      return '#2563eb'; // Bleu foncé
    } else if (normalized < 0) {
      // Rose pour les pertes avec gradient amélioré
      const intensity = Math.min(Math.abs(normalized), 1);
      if (intensity < 0.2) return '#fce7f3'; // Rose très clair
      if (intensity < 0.4) return '#f9a8d4'; // Rose clair
      if (intensity < 0.6) return '#f472b6'; // Rose moyen
      if (intensity < 0.8) return '#ec4899'; // Rose
      return '#db2777'; // Rose foncé
    }
    return '#f3f4f6'; // Gris pour zéro
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <AccountSelector value={accountId} onChange={setAccountId} />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('analytics:loadingData')}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance par heure (nuage de points) */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
              {t('analytics:charts.hourlyPerformanceScatter.title')}
            </h3>
            <div style={{ height: '320px', position: 'relative' }}>
              <ChartScatter
                data={{
                  datasets: [
                    {
                      label: t('analytics:charts.hourlyPerformanceScatter.label'),
                      data: hourlyPerformanceScatter.data.map(d => ({
                        x: d.hour,
                        y: d.pnl,
                      })),
                      backgroundColor: hourlyPerformanceScatter.data.map(d => 
                        d.pnl >= 0 ? '#3b82f6' : '#ec4899'
                      ),
                      pointRadius: 5,
                      pointHoverRadius: 7,
                      pointBorderWidth: 0,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    datalabels: {
                      display: false,
                    },
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: 'white',
                      titleColor: '#4b5563',
                      bodyColor: '#1f2937',
                      borderColor: '#e5e7eb',
                      borderWidth: 1,
                      padding: 16,
                      titleFont: {
                        size: 14,
                        weight: 600,
                      },
                      bodyFont: {
                        size: 13,
                        weight: 500,
                      },
                      displayColors: false,
                      callbacks: {
                        title: (items) => {
                          const item = items[0];
                          const raw = item.raw as { x: number; y: number };
                          const hour = raw.x;
                          return `${hour.toString().padStart(2, '0')}:00`;
                        },
                        label: (context) => {
                          const raw = context.raw as { x: number; y: number };
                          const pnl = raw.y;
                          return formatCurrency(pnl, currencySymbol);
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      type: 'linear',
                      position: 'bottom',
                      // Ajuster min/max pour n'afficher que les heures avec des données
                      min: hourlyPerformanceScatter.hoursWithData.length > 0 
                        ? Math.min(...hourlyPerformanceScatter.hoursWithData) - 0.5 
                        : -0.5,
                      max: hourlyPerformanceScatter.hoursWithData.length > 0 
                        ? Math.max(...hourlyPerformanceScatter.hoursWithData) + 0.5 
                        : 23.5,
                      ticks: {
                        // Générer des ticks uniquement pour les heures avec des données
                        stepSize: 1,
                        color: '#6b7280',
                        font: {
                          size: 11,
                        },
                        callback: function(value) {
                          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                          const hour = Math.round(numValue);
                          // Afficher seulement si l'heure fait partie des heures avec des données
                          if (hourlyPerformanceScatter.hoursWithData.includes(hour)) {
                            return t('analytics:common.hour', { hour: hour.toString().padStart(2, '0') });
                          }
                          return '';
                        },
                        maxRotation: 45,
                        minRotation: 45,
                      },
                      grid: {
                        color: '#e5e7eb',
                        lineWidth: 1,
                      },
                      border: {
                        color: '#d1d5db',
                      },
                      title: {
                        display: true,
                        text: t('analytics:charts.hourlyPerformanceScatter.xAxis'),
                        color: '#4b5563',
                        font: {
                          size: 13,
                          weight: 600,
                        },
                      },
                    },
                    y: {
                      ticks: {
                        color: '#6b7280',
                        font: {
                          size: 12,
                        },
                        callback: function(value) {
                          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                          return formatCurrency(numValue, currencySymbol);
                        },
                      },
                      grid: {
                        color: '#e5e7eb',
                        lineWidth: 1,
                      },
                      border: {
                        color: '#d1d5db',
                        display: false,
                      },
                      title: {
                        display: true,
                        text: t('analytics:charts.hourlyPerformanceScatter.yAxis'),
                        color: '#4b5563',
                        font: {
                          size: 13,
                          weight: 600,
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Corrélation PnL vs Nombre de Trades */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full mr-3"></div>
              {t('analytics:charts.correlation.title')}
            </h3>
            <div style={{ height: '320px', position: 'relative' }}>
              <ChartScatter
                data={{
                  datasets: [
                    {
                      label: t('analytics:charts.correlation.label'),
                      data: correlationData.dataPoints.map(d => ({
                        x: d.trades,
                        y: d.pnl,
                      })),
                      backgroundColor: correlationData.dataPoints.map(d => 
                        d.pnl >= 0 ? '#3b82f6' : '#ec4899'
                      ),
                      pointRadius: 5,
                      pointHoverRadius: 7,
                      pointBorderWidth: 0,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    datalabels: {
                      display: false,
                    },
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: 'white',
                      titleColor: '#4b5563',
                      bodyColor: '#1f2937',
                      borderColor: '#e5e7eb',
                      borderWidth: 1,
                      padding: 16,
                      titleFont: {
                        size: 14,
                        weight: 600,
                      },
                      bodyFont: {
                        size: 13,
                        weight: 500,
                      },
                      displayColors: false,
                      callbacks: {
                        title: (items) => {
                          const item = items[0];
                          const raw = item.raw as { x: number; y: number };
                          const trades = raw.x;
                          return `${trades} ${trades > 1 ? t('analytics:common.trades') : t('analytics:common.trade')}`;
                        },
                        label: (context) => {
                          const raw = context.raw as { x: number; y: number };
                          const pnl = raw.y;
                          return formatCurrency(pnl, currencySymbol);
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      type: 'linear',
                      position: 'bottom',
                      min: correlationData.minTrades - 0.5,
                      max: correlationData.maxTrades + 0.5,
                      ticks: {
                        stepSize: 1,
                        color: '#6b7280',
                        font: {
                          size: 12,
                        },
                        callback: function(value) {
                          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                          return Math.round(numValue).toString();
                        },
                      },
                      grid: {
                        color: '#e5e7eb',
                        lineWidth: 1,
                      },
                      border: {
                        color: '#d1d5db',
                      },
                      title: {
                        display: true,
                        text: t('analytics:charts.correlation.xAxis'),
                        color: '#4b5563',
                        font: {
                          size: 13,
                          weight: 600,
                        },
                      },
                    },
                    y: {
                      ticks: {
                        color: '#6b7280',
                        font: {
                          size: 12,
                        },
                        callback: function(value) {
                          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                          return formatCurrency(numValue, currencySymbol);
                        },
                      },
                      grid: {
                        color: '#e5e7eb',
                        lineWidth: 1,
                      },
                      border: {
                        color: '#d1d5db',
                        display: false,
                      },
                      title: {
                        display: true,
                        text: t('analytics:charts.correlation.yAxis'),
                        color: '#4b5563',
                        font: {
                          size: 13,
                          weight: 600,
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Drawdown par jour */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded-full mr-3"></div>
              <h3 className="text-xl font-bold text-gray-800">{t('analytics:charts.drawdown.title')}</h3>
              <TooltipComponent
                content={t('analytics:charts.drawdown.tooltip')}
                position="top"
              >
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors cursor-help">
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </TooltipComponent>
            </div>
            <div style={{ height: '320px', position: 'relative' }}>
              <ChartLine
                data={{
                  labels: drawdownData.map(d => d.date),
                  datasets: [
                    {
                      label: t('analytics:charts.drawdown.label'),
                      data: drawdownData.map(d => d.drawdown),
                      borderColor: '#ec4899',
                      backgroundColor: 'rgba(236, 72, 153, 0.1)',
                      borderWidth: 3,
                      pointRadius: 5,
                      pointBackgroundColor: '#ec4899',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 2,
                      pointHoverRadius: 7,
                      fill: true,
                      tension: 0, // Ligne droite, pas de courbe
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    datalabels: {
                      display: false,
                    },
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: 'white',
                      titleColor: '#4b5563',
                      bodyColor: '#1f2937',
                      borderColor: '#e5e7eb',
                      borderWidth: 1,
                      padding: 16,
                      titleFont: {
                        size: 14,
                        weight: 600,
                      },
                      bodyFont: {
                        size: 13,
                        weight: 500,
                      },
                      displayColors: false,
                      callbacks: {
                        title: (items) => {
                          const index = items[0].dataIndex;
                          return drawdownData[index].date;
                        },
                        label: (context) => {
                          const index = context.dataIndex;
                          const data = drawdownData[index];
                          return [
                            `${t('analytics:charts.drawdown.amount')}: ${formatCurrency(data.drawdownAmount, currencySymbol)}`,
                            `${t('analytics:charts.drawdown.percentage')}: ${data.drawdown.toFixed(2)}% (${t('analytics:charts.drawdown.lossFromPeak')})`,
                          ];
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: '#6b7280',
                        font: {
                          size: 11,
                        },
                      },
                      grid: {
                        color: '#e5e7eb',
                        lineWidth: 1,
                      },
                      border: {
                        color: '#d1d5db',
                      },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        color: '#6b7280',
                        font: {
                          size: 12,
                        },
                        callback: function(value) {
                          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                          return numValue.toFixed(1) + '%';
                        },
                      },
                      grid: {
                        color: '#e5e7eb',
                        lineWidth: 1,
                      },
                      border: {
                        color: '#d1d5db',
                        display: false,
                      },
                      title: {
                        display: true,
                        text: t('analytics:charts.drawdown.yAxis'),
                        color: '#4b5563',
                        font: {
                          size: 13,
                          weight: 600,
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Performance par heure (barres) */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full mr-3"></div>
              {t('analytics:charts.hourlyPerformanceBars.title')}
            </h3>
            <div style={{ height: '320px', position: 'relative' }}>
              <ChartBar
                data={{
                  labels: hourlyPerformanceBars.map(d => d.hour),
                  datasets: [
                    {
                      label: t('analytics:charts.hourlyPerformanceBars.label'),
                      data: hourlyPerformanceBars.map(d => d.pnl),
                      backgroundColor: hourlyPerformanceBars.map(d => 
                        d.pnl >= 0 ? '#3b82f6' : '#ec4899'
                      ),
                      borderRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    datalabels: {
                      display: false,
                    },
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: 'white',
                      titleColor: '#4b5563',
                      bodyColor: '#1f2937',
                      borderColor: '#e5e7eb',
                      borderWidth: 1,
                      padding: 16,
                      titleFont: {
                        size: 14,
                        weight: 600,
                      },
                      bodyFont: {
                        size: 13,
                        weight: 500,
                      },
                      displayColors: false,
                      callbacks: {
                        title: (items) => {
                          const index = items[0].dataIndex;
                          return hourlyPerformanceBars[index].hour;
                        },
                        label: (context) => {
                          const pnl = context.parsed.y ?? 0;
                          return formatCurrency(pnl, currencySymbol);
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      type: 'category' as const,
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: '#6b7280',
                        font: {
                          size: 11,
                        },
                        // Afficher tous les labels car on a déjà filtré les heures vides
                        autoSkip: false,
                      },
                      grid: {
                        display: false,
                      },
                      border: {
                        color: '#d1d5db',
                      },
                    },
                    y: {
                      ticks: {
                        color: '#6b7280',
                        font: {
                          size: 12,
                        },
                        callback: function(value) {
                          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                          return formatCurrency(numValue, currencySymbol);
                        },
                      },
                      grid: {
                        color: '#e5e7eb',
                        lineWidth: 1,
                      },
                      border: {
                        color: '#d1d5db',
                        display: false,
                      },
                      title: {
                        display: true,
                        text: t('analytics:charts.hourlyPerformanceBars.yAxis'),
                        color: '#4b5563',
                        font: {
                          size: 13,
                          weight: 600,
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Heatmap Jour × Heure */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full mr-3"></div>
              {t('analytics:charts.heatmap.title')}
            </h3>
            <div className="overflow-x-auto -mx-2 px-2">
              <div className="inline-block min-w-full">
                <div className="mb-3">
                  {/* En-tête des heures */}
                  <div className="flex ml-14">
                    {Array.from({ length: 24 }, (_, i) => (
                      <div
                        key={i}
                        className="flex-1 text-xs text-gray-600 text-center font-semibold min-w-[22px]"
                      >
                        {i.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Grille de la heatmap */}
                <div className="space-y-1" ref={heatmapContainerRef}>
                  {heatmapData.daysOfWeek.map((day, dayIndex) => (
                    <div key={day} className="flex items-center">
                      <div className="w-14 text-sm font-semibold text-gray-700 text-right pr-2">
                        {day}
                      </div>
                      <div className="flex flex-1">
                        {Array.from({ length: 24 }, (_, hour) => {
                          const value = heatmapData.data[dayIndex][hour];
                          const color = getHeatmapColor(value, heatmapData.maxAbs);
                          return (
                            <div
                              key={hour}
                              className="flex-1 h-7 border-2 border-white rounded-md hover:border-gray-300 hover:scale-110 transition-all duration-200 cursor-pointer relative min-w-[22px] shadow-sm"
                              style={{ backgroundColor: color }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                
                                // Calculer la position du tooltip
                                const tooltipWidth = 150;
                                const tooltipHeight = 70;
                                const padding = 8;
                                
                                let x = rect.left + rect.width / 2;
                                let y = rect.top - tooltipHeight - padding;
                                
                                // Deux premières lignes : tooltip en dessous
                                const isFirstTwoRows = dayIndex <= 1;
                                if (isFirstTwoRows) {
                                  y = rect.bottom + padding;
                                }
                                
                                // Dernières colonnes : aligner à droite
                                const isLastColumns = hour >= 20;
                                if (isLastColumns) {
                                  x = rect.right - tooltipWidth;
                                  // Si déborde à gauche, centrer
                                  if (x < padding) {
                                    x = rect.left + rect.width / 2;
                                  }
                                } else {
                                  // Centrer mais éviter les débordements
                                  if (x - tooltipWidth / 2 < padding) {
                                    x = tooltipWidth / 2 + padding;
                                  } else if (x + tooltipWidth / 2 > window.innerWidth - padding) {
                                    x = window.innerWidth - tooltipWidth / 2 - padding;
                                  }
                                }
                                
                                // Ajuster verticalement si nécessaire
                                if (y < padding) {
                                  y = rect.bottom + padding;
                                }
                                if (y + tooltipHeight > window.innerHeight - padding) {
                                  y = rect.top - tooltipHeight - padding;
                                  // Si toujours trop bas, placer en dessous
                                  if (y < padding) {
                                    y = rect.bottom + padding;
                                  }
                                }
                                
                                setHeatmapTooltip({
                                  day,
                                  hour,
                                  value,
                                  x: Math.max(padding, x),
                                  y: Math.max(padding, y),
                                });
                              }}
                              onMouseLeave={() => {
                                setHeatmapTooltip(null);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Légende améliorée */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-md shadow-sm" style={{ backgroundColor: '#ec4899' }}></div>
                    <span className="text-gray-700 font-medium">{t('analytics:charts.heatmap.losses')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-md shadow-sm bg-gray-200"></div>
                    <span className="text-gray-700 font-medium">{t('analytics:charts.heatmap.neutral')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-md shadow-sm" style={{ backgroundColor: '#3b82f6' }}></div>
                    <span className="text-gray-700 font-medium">{t('analytics:charts.heatmap.gains')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution des PnL */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full mr-3"></div>
              {t('analytics:charts.pnlDistribution.title')}
            </h3>
            <div style={{ height: '320px', position: 'relative' }}>
              <ChartBar
                data={{
                  labels: pnlDistribution.map((d, index) => {
                    // Format compact pour les labels : afficher seulement le début de l'intervalle
                    // L'intervalle complet est disponible dans le tooltip
                    return formatCurrency(d.start || parseFloat(d.range), currencySymbol);
                  }),
                  datasets: [
                    {
                      label: t('analytics:charts.pnlDistribution.label'),
                      data: (() => {
                        const totalTrades = pnlDistribution.reduce((sum, d) => sum + d.count, 0);
                        return pnlDistribution.map(d => totalTrades > 0 ? (d.count / totalTrades) * 100 : 0);
                      })(),
                      backgroundColor: pnlDistribution.map(d => 
                        d.isPositive ? '#3b82f6' : '#ec4899'
                      ),
                      borderRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    datalabels: {
                      display: false,
                    },
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: 'white',
                      titleColor: '#4b5563',
                      bodyColor: '#1f2937',
                      borderColor: '#e5e7eb',
                      borderWidth: 1,
                      padding: 16,
                      titleFont: {
                        size: 14,
                        weight: 600,
                      },
                      bodyFont: {
                        size: 13,
                        weight: 500,
                      },
                      displayColors: false,
                      callbacks: {
                        title: (items) => {
                          const index = items[0].dataIndex;
                          const bin = pnlDistribution[index];
                          // Extraire start et end du rangeLabel
                          const rangeMatch = bin.rangeLabel.match(/^(.+?)\s*-\s*(.+?)$/);
                          let startValue = parseFloat(bin.range);
                          let endValue = startValue;
                          
                          if (rangeMatch && rangeMatch[2]) {
                            endValue = parseFloat(rangeMatch[2].trim());
                          } else if (pnlDistribution[index + 1]) {
                            endValue = parseFloat(pnlDistribution[index + 1].range);
                          } else {
                            // Si c'est le dernier bin, utiliser binWidth
                            endValue = startValue + (bin.binWidth || (startValue * 0.1));
                          }
                          
                          const startFormatted = formatCurrency(startValue, currencySymbol);
                          const endFormatted = formatCurrency(endValue, currencySymbol);
                          return t('analytics:charts.pnlDistribution.range', { start: startFormatted, end: endFormatted });
                        },
                        label: (context) => {
                          const index = context.dataIndex;
                          const count = pnlDistribution[index].count;
                          const percentage = context.parsed.y ?? 0;
                          const totalTrades = pnlDistribution.reduce((sum, d) => sum + d.count, 0);
                          return [
                            `${count} ${count > 1 ? t('analytics:common.trades') : t('analytics:common.trade')}`,
                            `${percentage.toFixed(1)}% (${t('analytics:charts.pnlDistribution.onTotal', { total: totalTrades })})`
                          ];
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: '#6b7280',
                        font: {
                          size: 12,
                        },
                        // Afficher seulement un label sur deux pour éviter la surcharge quand il y a beaucoup de valeurs
                        callback: function(value: any, index: number, ticks: any[]) {
                          // Si plus de 8 bins, afficher seulement un label sur deux
                          if (pnlDistribution.length > 8) {
                            return index % 2 === 0 ? this.getLabelForValue(value) : '';
                          }
                          return this.getLabelForValue(value);
                        },
                        maxTicksLimit: 10, // Limiter le nombre de ticks affichés
                      },
                      grid: {
                        display: false,
                      },
                      border: {
                        color: '#d1d5db',
                      },
                      title: {
                        display: false,
                      },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        color: '#6b7280',
                        font: {
                          size: 12,
                        },
                        callback: function(value) {
                          const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                          return numValue.toFixed(1) + '%';
                        },
                      },
                      grid: {
                        color: '#e5e7eb',
                        lineWidth: 1,
                      },
                      border: {
                        color: '#d1d5db',
                        display: false,
                      },
                      title: {
                        display: true,
                        text: t('analytics:charts.pnlDistribution.yAxis'),
                        color: '#4b5563',
                        font: {
                          size: 13,
                          weight: 600,
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      <FloatingActionButton onClick={() => setShowImport(true)} title={t('analytics:importTrades')} />
      <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
      
      {/* Tooltip portal pour la heatmap - rendu à la racine */}
      {heatmapTooltip && typeof window !== 'undefined' && document.body && createPortal(
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl p-4 whitespace-nowrap pointer-events-none"
          style={{
            left: `${heatmapTooltip.x}px`,
            top: `${heatmapTooltip.y}px`,
            transform: heatmapTooltip.hour >= 20 ? 'none' : 'translateX(-50%)',
            zIndex: 99999,
          }}
        >
          <p className="text-sm text-gray-600 mb-2 font-medium" style={{ fontSize: '14px', fontWeight: 600 }}>
            {heatmapTooltip.day} {t('analytics:common.hour', { hour: heatmapTooltip.hour.toString().padStart(2, '0') })}
          </p>
          <p className="text-base font-semibold text-gray-900" style={{ fontSize: '13px', fontWeight: 500 }}>
            {formatCurrency(heatmapTooltip.value, currencySymbol)}
          </p>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AnalyticsPage;
