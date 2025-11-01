import React, { useState, useEffect, useMemo } from 'react';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { User } from '../services/auth';
import { tradesService, TradeListItem } from '../services/trades';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { tradeStrategiesService, TradeStrategy } from '../services/tradeStrategies';
import ModernStatCard from '../components/common/ModernStatCard';
import DurationDistributionChart from '../components/charts/DurationDistributionChart';
import { usePreferences } from '../hooks/usePreferences';
import { formatCurrency as formatCurrencyUtil } from '../utils/numberFormat';
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
import { Bar as ChartBar, Line as ChartLine } from 'react-chartjs-2';

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

interface DashboardPageProps {
  currentUser: User;
}

// Fonction utilitaire pour formater les montants avec séparateurs de milliers (remplacée par formatCurrencyUtil avec préférences)

// Fonction pour convertir hex en rgba
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Fonction pour obtenir le label de performance variable
const getPerformanceLabel = (
  currentValue: number,
  objective: number,
  metricType: 'winRate' | 'avgWinning' | 'avgLosing'
): { label: string; color: string; bgColor: string; borderColor: string } => {
  let percentage: number;
  let color: string;
  let label: string;
  
  if (metricType === 'winRate') {
    // Pour winRate, utiliser des seuils absolus fixes
    // Standards du trading : 60%+ excellent, 50%+ bon, 40%+ moyen, <40% à améliorer
    if (currentValue >= 60) {
      label = 'Excellent';
      color = '#10b981'; // green
    } else if (currentValue >= 50) {
      label = 'Bon';
      color = '#10b981'; // green
    } else if (currentValue >= 40) {
      label = 'Moyen';
      color = '#f59e0b'; // orange
    } else {
      label = 'À améliorer';
      color = '#ef4444'; // red
    }
  } else if (metricType === 'avgLosing') {
    // Pour avgLosing, on veut un montant FAIBLE, donc on inverse la logique
    // Plus c'est bas par rapport à l'objectif, mieux c'est
    percentage = (1 - Math.min(currentValue / objective, 1)) * 100;
    
    if (percentage >= 90) {
      label = 'Excellent';
      color = '#10b981'; // green
    } else if (percentage >= 70) {
      label = 'Très bon';
      color = '#10b981'; // green
    } else if (percentage >= 50) {
      label = 'Bon';
      color = '#f59e0b'; // orange
    } else if (percentage >= 30) {
      label = 'Moyen';
      color = '#f59e0b'; // orange
    } else {
      label = 'À améliorer';
      color = '#ef4444'; // red
    }
  } else {
    // Pour avgWinning, plus c'est haut par rapport à l'objectif, mieux c'est
    percentage = Math.min((currentValue / objective) * 100, 100);
    
    if (percentage >= 90) {
      label = 'Excellent';
      color = '#10b981'; // green
    } else if (percentage >= 70) {
      label = 'Très bon';
      color = '#10b981'; // green
    } else if (percentage >= 50) {
      label = 'Bon';
      color = '#f59e0b'; // orange
    } else if (percentage >= 30) {
      label = 'Moyen';
      color = '#f59e0b'; // orange
    } else {
      label = 'À améliorer';
      color = '#ef4444'; // red
    }
  }
  
  return {
    label,
    color,
    bgColor: hexToRgba(color, 0.2),
    borderColor: hexToRgba(color, 0.4),
  };
};

// Fonction pour parser la durée ISO (ex: "PT7M34S" ou "00:07:34")
const parseDuration = (durationStr: string | null): number => {
  if (!durationStr) return 0;
  
  // Si c'est au format HH:MM:SS
  if (durationStr.includes(':')) {
    const parts = durationStr.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return hours * 60 + minutes + seconds / 60;
    }
  }
  
  // Sinon, parser le format ISO duration (PT7M34S)
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseFloat(match[3] || '0');
    return hours * 60 + minutes + seconds / 60;
  }
  
  return 0;
};

// Fonction pour catégoriser la durée
const categorizeDuration = (minutes: number): string => {
  if (minutes < 5) return '5m';
  if (minutes < 10) return '5-10m';
  if (minutes < 20) return '10-20m';
  if (minutes < 30) return '20-30m';
  if (minutes < 45) return '30-45m';
  if (minutes < 60) return '45-60m';
  return '60m+';
};

const DashboardPage: React.FC<DashboardPageProps> = ({ currentUser }) => {
  const { preferences } = usePreferences();
  const [showImport, setShowImport] = useState(false);
  const [accountId, setAccountId] = useState<number | null>(null);
  
  // Wrapper pour formatCurrency avec préférences
  const formatCurrency = (value: number, currencySymbol: string = ''): string => {
    return formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2);
  };
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [strategies, setStrategies] = useState<Map<number, TradeStrategy>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  // Générer les années disponibles (année en cours et 5 ans précédents)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const availableMonths = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' },
  ];

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

  // Charger les trades avec filtres
  useEffect(() => {
    const loadTrades = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const filters: any = {
          trading_account: accountId ?? undefined,
          page_size: 10000, // Récupérer beaucoup de trades
        };

        // Ajouter le filtre de date selon l'année et le mois
        if (selectedYear) {
          const startDate = selectedMonth 
            ? `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`
            : `${selectedYear}-01-01`;
          
          const endDate = selectedMonth
            ? new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]
            : `${selectedYear}-12-31`;
          
          filters.start_date = startDate;
          filters.end_date = endDate;
        }

        const response = await tradesService.list(filters);
        
        // Filtrer par année/mois côté client aussi pour être sûr
        let filteredTrades = response.results;
        if (selectedYear) {
          filteredTrades = filteredTrades.filter(trade => {
            if (!trade.trade_day) return false;
            const tradeDate = new Date(trade.trade_day);
            const tradeYear = tradeDate.getFullYear();
            const tradeMonth = tradeDate.getMonth() + 1;
            
            if (selectedMonth) {
              return tradeYear === selectedYear && tradeMonth === selectedMonth;
            }
            return tradeYear === selectedYear;
          });
        }
        
        // Trier par date d'entrée croissante pour le calcul du solde
        filteredTrades.sort((a, b) => {
          const dateA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
          const dateB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
          return dateA - dateB;
        });
        
        setTrades(filteredTrades);

        // Charger les stratégies pour tous les trades
        const strategiesMap = new Map<number, TradeStrategy>();
        try {
          // Récupérer toutes les dates uniques des trades
          const uniqueDates = new Set<string>();
          filteredTrades.forEach(trade => {
            if (trade.trade_day) {
              uniqueDates.add(trade.trade_day);
            }
          });

          // Charger les stratégies pour chaque date
          const datesArray = Array.from(uniqueDates);
          for (const date of datesArray) {
            try {
              const dateStrategies = await tradeStrategiesService.byDate(date, accountId ?? undefined);
              dateStrategies.forEach(strategy => {
                // strategy.trade est l'ID numérique du trade TopStepTrade
                strategiesMap.set(strategy.trade, strategy);
              });
            } catch (e) {
              // Ignorer les erreurs pour les dates sans stratégies
            }
          }
        } catch (err) {
          console.error('Erreur lors du chargement des stratégies', err);
        }

        setStrategies(strategiesMap);
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrades();
  }, [accountId, selectedYear, selectedMonth]);

  // Calculer le solde du compte dans le temps avec format { date, pnl, cumulative }
  const accountBalanceData = useMemo(() => {
    // Créer des entrées par date pour chaque trade
    const tradesWithDates = trades
      .filter(trade => trade.net_pnl && trade.entered_at)
      .map(trade => ({
        date: trade.trade_day || new Date(trade.entered_at).toISOString().split('T')[0],
        pnl: parseFloat(trade.net_pnl!),
        enteredAt: new Date(trade.entered_at),
      }))
      .sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());

    // Grouper par date
    const dailyData: { [date: string]: number } = {};
    tradesWithDates.forEach(trade => {
      dailyData[trade.date] = (dailyData[trade.date] || 0) + trade.pnl;
    });

    const sortedDates = Object.keys(dailyData).sort();
    let cumulativeBalance = 0;
    
    return sortedDates.map(date => {
      const dailyPnl = dailyData[date];
      cumulativeBalance += dailyPnl;
      return {
        date: date, // Format YYYY-MM-DD pour les filtres
        pnl: dailyPnl,
        cumulative: cumulativeBalance,
      };
    });
  }, [trades]);

  // États pour les filtres de date
  const { defaultStartDate, defaultEndDate } = useMemo(() => {
    if (accountBalanceData.length === 0) return { defaultStartDate: '', defaultEndDate: '' };
    const dates = accountBalanceData.map(d => d.date).sort();
    return {
      defaultStartDate: dates[0] || '',
      defaultEndDate: dates[dates.length - 1] || ''
    };
  }, [accountBalanceData]);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  // Initialiser et mettre à jour les dates quand elles changent
  useEffect(() => {
    if (defaultStartDate && defaultEndDate) {
      if (defaultStartDate <= defaultEndDate) {
        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
      } else {
        setStartDate(defaultEndDate);
        setEndDate(defaultStartDate);
      }
    }
  }, [defaultStartDate, defaultEndDate]);

  // Filtrer les données par période
  const filteredBalanceData = useMemo(() => {
    if (!startDate || !endDate || accountBalanceData.length === 0) return accountBalanceData;
    return accountBalanceData.filter(d => d.date >= startDate && d.date <= endDate);
  }, [accountBalanceData, startDate, endDate]);

  // Calculer les statistiques de performance
  const performanceStats = useMemo(() => {
    if (filteredBalanceData.length === 0) {
      return { totalReturn: 0, isPositive: false, maxDrawdown: 0, highestValue: 0, lowestValue: 0 };
    }
    // Solde final de la période filtrée
    const endingBalance = filteredBalanceData[filteredBalanceData.length - 1]?.cumulative || 0;
    // Variation pendant la période (solde final - solde de départ)
    const startingBalance = filteredBalanceData[0]?.cumulative || 0;
    const totalReturn = endingBalance - startingBalance;
    const highestValue = Math.max(...filteredBalanceData.map(d => d.cumulative));
    const lowestValue = Math.min(...filteredBalanceData.map(d => d.cumulative));
    // Selon les bonnes pratiques: la couleur reflète si la courbe passe au-dessus de 0
    // Si la valeur maximale est >= 0 (courbe passe au-dessus de 0), couleur positive (bleu)
    // Si toutes les valeurs sont < 0 (courbe toujours en dessous de 0), couleur négative (rose)
    const isPositive = highestValue >= 0;
    
    return { totalReturn, isPositive, highestValue, lowestValue };
  }, [filteredBalanceData]);

  // Préparer les données du graphique avec deux datasets (positif/négatif)
  const accountBalanceChartData = useMemo(() => {
    if (filteredBalanceData.length === 0) return null;

    const labels = filteredBalanceData.map(d => 
      new Date(d.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
    );
    const cumulativeValues = filteredBalanceData.map(d => d.cumulative);
    const pnlValues = filteredBalanceData.map(d => d.pnl);

    // Créer deux datasets : un pour les valeurs positives (>= 0), un pour les négatives (< 0)
    const positiveValues: (number | null)[] = [];
    const negativeValues: (number | null)[] = [];
    const chartLabels: string[] = [];
    // Mapping pour retrouver l'index original et le PnL depuis l'index du graphique
    const indexMapping: number[] = [];
    const pnlMapping: number[] = [];

    filteredBalanceData.forEach((point, index) => {
      const value = point.cumulative;
      
      if (index === 0) {
        // Premier point
        chartLabels.push(labels[index]);
        indexMapping.push(index);
        pnlMapping.push(point.pnl);
        if (value >= 0) {
          positiveValues.push(value);
          negativeValues.push(null);
        } else {
          positiveValues.push(null);
          negativeValues.push(value);
        }
      } else {
        const prevValue = filteredBalanceData[index - 1].cumulative;
        
        // Si transition entre positif et négatif
        if ((prevValue >= 0 && value < 0) || (prevValue < 0 && value >= 0)) {
          // Ajouter un point à 0 pour la transition
          chartLabels.push(labels[index]);
          indexMapping.push(index);
          pnlMapping.push(point.pnl);
          positiveValues.push(0);
          negativeValues.push(0);
          // Puis ajouter le point actuel
          chartLabels.push(labels[index]);
          indexMapping.push(index);
          pnlMapping.push(point.pnl);
          if (value >= 0) {
            positiveValues.push(value);
            negativeValues.push(null);
          } else {
            positiveValues.push(null);
            negativeValues.push(value);
          }
        } else {
          // Pas de transition
          chartLabels.push(labels[index]);
          indexMapping.push(index);
          pnlMapping.push(point.pnl);
          if (value >= 0) {
            positiveValues.push(value);
            negativeValues.push(null);
          } else {
            positiveValues.push(null);
            negativeValues.push(value);
          }
        }
      }
    });

    const textColor = performanceStats.isPositive ? 'text-blue-600' : 'text-pink-600';

    return {
      labels: chartLabels,
      positiveValues,
      negativeValues,
      cumulativeValues,
      pnlValues,
      indexMapping,
      pnlMapping,
      textColor,
    };
  }, [filteredBalanceData, performanceStats]);

  // Calculer la répartition des trades par durée (gagnants et perdants)
  const durationDistribution = useMemo(() => {
    const categories = {
      '5m': { winning: 0, losing: 0 },
      '5-10m': { winning: 0, losing: 0 },
      '10-20m': { winning: 0, losing: 0 },
      '20-30m': { winning: 0, losing: 0 },
      '30-45m': { winning: 0, losing: 0 },
      '45-60m': { winning: 0, losing: 0 },
      '60m+': { winning: 0, losing: 0 },
    };

    trades.forEach(trade => {
      if (trade.trade_duration) {
        const minutes = parseDuration(trade.trade_duration);
        const category = categorizeDuration(minutes);
        const isWinning = trade.is_profitable === true;
        if (isWinning) {
          categories[category as keyof typeof categories].winning++;
        } else if (trade.is_profitable === false) {
          categories[category as keyof typeof categories].losing++;
        }
      }
    });

    return Object.entries(categories)
      .map(([label, data]) => ({
        label,
        winning: data.winning,
        losing: data.losing,
        total: data.winning + data.losing,
      }))
      .filter(item => item.total > 0); // Filtrer les catégories vides
  }, [trades]);

  // Préparer les données pour le graphique de répartition par durée
  const durationDistributionBins = useMemo(() => {
    return durationDistribution.map(item => ({
      label: item.label,
      successful: item.winning,
      unsuccessful: item.losing,
    }));
  }, [durationDistribution]);

  // Préparer les données pour le graphique waterfall
  const waterfallData = useMemo(() => {
    // Créer des entrées par date pour chaque trade
    const tradesWithDates = trades
      .filter(trade => trade.net_pnl && trade.entered_at)
      .map(trade => ({
        date: trade.trade_day || new Date(trade.entered_at).toISOString().split('T')[0],
        pnl: parseFloat(trade.net_pnl!),
        enteredAt: new Date(trade.entered_at),
      }))
      .sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());

    // Grouper par date
    const dailyData: { [date: string]: number } = {};
    tradesWithDates.forEach(trade => {
      dailyData[trade.date] = (dailyData[trade.date] || 0) + trade.pnl;
    });

    const sortedDates = Object.keys(dailyData).sort();
    let cumulativeBalance = 0;
    
    return sortedDates.map(date => {
      const dailyPnl = dailyData[date];
      cumulativeBalance += dailyPnl;
      return {
        date: new Date(date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        pnl: dailyPnl,
        cumulative: cumulativeBalance,
        is_positive: dailyPnl >= 0,
      };
    });
  }, [trades]);

  // Préparer les données pour le graphique waterfall avec barres flottantes
  const waterfallChartData = useMemo(() => {
    if (waterfallData.length === 0) return null;

    const labels = waterfallData.map(d => d.date);
    
    // Pour un graphique waterfall, nous créons des barres flottantes
    // Chaque barre va de la valeur précédente à la valeur actuelle
    const waterfallBarData = waterfallData.map((d, index) => {
      const previousCumulative = index === 0 ? 0 : waterfallData[index - 1].cumulative;
      const currentCumulative = d.cumulative;
      
      return {
        start: previousCumulative,
        end: currentCumulative,
        value: d.pnl,
        isPositive: d.pnl >= 0,
        cumulative: currentCumulative
      };
    });

    // Transformer les données en format [min, max] pour les barres flottantes
    const floatingBars = waterfallBarData.map(d => [d.start, d.end]);

    return {
      labels,
      datasets: [
        {
          label: 'Évolution du Capital',
          data: floatingBars,
          backgroundColor: waterfallBarData.map(d => 
            d.isPositive ? 'rgba(59, 130, 246, 0.8)' : 'rgba(236, 72, 153, 0.8)'
          ),
          borderColor: waterfallBarData.map(d => 
            d.isPositive ? '#3b82f6' : '#ec4899'
          ),
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
          _waterfallData: waterfallBarData
        }
      ]
    };
  }, [waterfallData]);

  // Statistiques pour le waterfall
  const waterfallStats = useMemo(() => {
    if (waterfallData.length === 0) return null;

    const totalPnl = waterfallData[waterfallData.length - 1]?.cumulative || 0;
    const bestDay = Math.max(...waterfallData.map(d => d.pnl));
    const worstDay = Math.min(...waterfallData.map(d => d.pnl));
    const positiveDays = waterfallData.filter(d => d.pnl > 0).length;
    const negativeDays = waterfallData.filter(d => d.pnl < 0).length;
    const winRate = waterfallData.length > 0 ? (positiveDays / waterfallData.length) * 100 : 0;

    return {
      totalPnl,
      bestDay,
      worstDay,
      positiveDays,
      negativeDays,
      winRate
    };
  }, [waterfallData]);

  // Calculer la performance par jour de la semaine
  const weekdayPerformanceData = useMemo(() => {
    const dayStats: { [day: string]: { total_pnl: number; trade_count: number; winning_trades: number } } = {
      'Lundi': { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      'Mardi': { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      'Mercredi': { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      'Jeudi': { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      'Vendredi': { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      'Samedi': { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      'Dimanche': { total_pnl: 0, trade_count: 0, winning_trades: 0 },
    };

    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    trades.forEach(trade => {
      if (trade.entered_at && trade.net_pnl !== null) {
        const date = new Date(trade.entered_at);
        const dayName = dayNames[date.getDay()];
        const pnl = parseFloat(trade.net_pnl);
        
        if (dayStats[dayName]) {
          dayStats[dayName].total_pnl += pnl;
          dayStats[dayName].trade_count += 1;
          if (trade.is_profitable === true) {
            dayStats[dayName].winning_trades += 1;
          }
        }
      }
    });

    // Convertir en tableau et calculer le win rate
    return Object.entries(dayStats)
      .map(([day, stats]) => ({
        day,
        total_pnl: stats.total_pnl,
        trade_count: stats.trade_count,
        win_rate: stats.trade_count > 0 ? (stats.winning_trades / stats.trade_count) * 100 : 0,
        average_pnl: stats.trade_count > 0 ? stats.total_pnl / stats.trade_count : 0,
      }))
      .filter(d => d.day !== 'Samedi' && d.day !== 'Dimanche'); // Filtrer les weekends
  }, [trades]);

  // Préparer les données pour le graphique de performance par jour
  const weekdayChartData = useMemo(() => {
    if (weekdayPerformanceData.length === 0) return null;

    const labels = weekdayPerformanceData.map(d => d.day);
    const totalPnlValues = weekdayPerformanceData.map(d => d.total_pnl);

    return {
      labels,
      datasets: [
        {
          label: 'PnL Total',
          data: totalPnlValues,
          backgroundColor: totalPnlValues.map(value => 
            value >= 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(236, 72, 153, 0.8)'
          ),
          borderColor: totalPnlValues.map(value => 
            value >= 0 ? '#3b82f6' : '#ec4899'
          ),
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        }
      ]
    };
  }, [weekdayPerformanceData]);

  // Calculer les limites intelligentes pour l'axe Y - toujours inclure 0 avec valeurs arrondies
  const weekdayYAxisLimits = useMemo(() => {
    if (weekdayPerformanceData.length === 0) return { min: 0, max: 100, stepSize: 20 };

    const values = weekdayPerformanceData.map(d => d.total_pnl);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    // Plage effective qui inclut toujours 0
    const effectiveMin = Math.min(minValue, 0);
    const effectiveMax = Math.max(maxValue, 0);
    const effectiveRange = effectiveMax - effectiveMin;
    
    // Calculer le stepSize optimal - on veut environ 6-8 ticks
    const targetTicks = 7;
    let step = effectiveRange / targetTicks;
    
    // Arrondir le step à une valeur "ronde"
    if (step === 0 || !isFinite(step)) {
      step = Math.max(Math.abs(effectiveMax), Math.abs(effectiveMin), 100) / targetTicks;
    }
    
    const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
    const normalized = step / magnitude;
    
    let niceStep: number;
    if (normalized <= 1) niceStep = 1;
    else if (normalized <= 2) niceStep = 2;
    else if (normalized <= 5) niceStep = 5;
    else niceStep = 10;
    
    const stepSize = niceStep * magnitude;
    
    // Calculer les limites minimales nécessaires pour inclure toutes les données
    // Arrondir à la valeur inférieure pour min et supérieure pour max
    let roundedMin = Math.floor(effectiveMin / stepSize) * stepSize;
    let roundedMax = Math.ceil(effectiveMax / stepSize) * stepSize;
    
    // Ajuster si nécessaire pour inclure toutes les données exactes
    while (roundedMin > minValue) {
      roundedMin -= stepSize;
    }
    while (roundedMax < maxValue) {
      roundedMax += stepSize;
    }
    
    // S'assurer que 0 est toujours inclus
    roundedMin = Math.min(roundedMin, 0);
    roundedMax = Math.max(roundedMax, 0);
    
    // Ajouter une marge supplémentaire en haut (5% de la plage) pour les datalabels
    const range = roundedMax - roundedMin;
    const margin = range * 0.05;
    const adjustedMax = roundedMax + margin;
    
    // Arrondir la limite ajustée au multiple du stepSize supérieur
    const finalMax = Math.ceil(adjustedMax / stepSize) * stepSize;
    
    return {
      min: roundedMin,
      max: finalMax,
      stepSize: stepSize
    };
  }, [weekdayPerformanceData]);

  // Statistiques pour le graphique de performance par jour
  const weekdayStats = useMemo(() => {
    if (weekdayPerformanceData.length === 0) return null;

    const bestDay = weekdayPerformanceData.reduce((max, day) => 
      day.total_pnl > max.total_pnl ? day : max, 
      weekdayPerformanceData[0]
    );
    const worstDay = weekdayPerformanceData.reduce((min, day) => 
      day.trade_count < min.trade_count ? day : min, 
      weekdayPerformanceData[0]
    );
    const mostActiveDay = weekdayPerformanceData.reduce((max, day) => 
      day.trade_count > max.trade_count ? day : max, 
      weekdayPerformanceData[0]
    );
    const totalTrades = weekdayPerformanceData.reduce((sum, day) => sum + day.trade_count, 0);
    const totalPnl = weekdayPerformanceData.reduce((sum, day) => sum + day.total_pnl, 0);

    return {
      bestDay,
      worstDay,
      mostActiveDay,
      totalTrades,
      totalPnl
    };
  }, [weekdayPerformanceData]);

  // Calculer les métriques de trading pour les jauges circulaires
  const tradingMetrics = useMemo(() => {
    if (trades.length === 0) return null;

    const winningTrades = trades.filter(t => t.is_profitable === true && t.net_pnl);
    const losingTrades = trades.filter(t => t.is_profitable === false && t.net_pnl);
    
    const totalTrades = trades.filter(t => t.is_profitable !== null).length;
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
    
    const avgWinningTrade = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl!), 0) / winningTrades.length
      : 0;
    
    const avgLosingTrade = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl!), 0) / losingTrades.length
      : 0;

    return {
      winRate,
      avgWinningTrade,
      avgLosingTrade,
    };
  }, [trades]);

  // Calculer les max pour les jauges (basé sur les données réelles avec marge)
  const gaugeMaxValues = useMemo(() => {
    if (!tradingMetrics) return { winRate: 100, avgWinning: 1200, avgLosing: 850 };
    
    return {
      winRate: 100,
      avgWinning: Math.max(tradingMetrics.avgWinningTrade * 1.5, 500),
      avgLosing: Math.max(Math.abs(tradingMetrics.avgLosingTrade) * 1.5, 500),
    };
  }, [tradingMetrics]);

  // Calculer les objectifs pour chaque jauge
  const gaugeObjectives = useMemo(() => {
    if (!tradingMetrics || !gaugeMaxValues) return null;
    
    return {
      winRate: Math.max(60, Math.ceil(tradingMetrics.winRate / 10) * 10),
      avgWinning: gaugeMaxValues.avgWinning * 0.9,
      avgLosing: gaugeMaxValues.avgLosing * 0.7,
    };
  }, [tradingMetrics, gaugeMaxValues]);

  // Calculer les labels de performance pour chaque jauge
  const performanceLabels = useMemo(() => {
    if (!tradingMetrics || !gaugeObjectives) return null;
    
    return {
      winRate: getPerformanceLabel(tradingMetrics.winRate, gaugeObjectives.winRate, 'winRate'),
      avgWinning: getPerformanceLabel(tradingMetrics.avgWinningTrade, gaugeObjectives.avgWinning, 'avgWinning'),
      avgLosing: getPerformanceLabel(Math.abs(tradingMetrics.avgLosingTrade), gaugeObjectives.avgLosing, 'avgLosing'),
    };
  }, [tradingMetrics, gaugeObjectives]);

  // Calculer les statistiques supplémentaires pour les cartes
  const additionalStats = useMemo(() => {
    if (trades.length === 0) return null;

    const totalTrades = trades.filter(t => t.is_profitable !== null).length;
    const winningTrades = trades.filter(t => t.is_profitable === true && t.net_pnl);
    const losingTrades = trades.filter(t => t.is_profitable === false && t.net_pnl);
    
    const totalPnl = trades.reduce((sum, t) => sum + (t.net_pnl ? parseFloat(t.net_pnl) : 0), 0);
    const totalWinnings = winningTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl!), 0);
    const totalLosses = losingTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl!), 0);
    
    const profitFactor = totalLosses !== 0 ? Math.abs(totalWinnings / Math.abs(totalLosses)) : 0;
    
    // Calculer les frais totaux (fees + commissions)
    const totalFees = trades.reduce((sum, t) => {
      const fees = t.fees ? parseFloat(t.fees) : 0;
      const commissions = t.commissions ? parseFloat(t.commissions) : 0;
      return sum + fees + commissions;
    }, 0);

    // Calculer les séquences consécutives avec/sans respect de la stratégie
    let maxConsecutiveRespected = 0;
    let maxConsecutiveNotRespected = 0;
    let currentConsecutiveRespected = 0;
    let currentConsecutiveNotRespected = 0;

    // Trier les trades par date d'entrée pour calculer les séquences consécutives
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
      const dateB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
      return dateA - dateB;
    });

    sortedTrades.forEach(trade => {
      const strategy = strategies.get(trade.id);
      const isRespected = strategy?.strategy_respected;

      if (isRespected === true) {
        currentConsecutiveRespected++;
        currentConsecutiveNotRespected = 0;
        maxConsecutiveRespected = Math.max(maxConsecutiveRespected, currentConsecutiveRespected);
      } else if (isRespected === false) {
        currentConsecutiveNotRespected++;
        currentConsecutiveRespected = 0;
        maxConsecutiveNotRespected = Math.max(maxConsecutiveNotRespected, currentConsecutiveNotRespected);
      } else {
        // Si strategy_respected est null ou undefined (pas de stratégie), réinitialiser les compteurs
        // pour ne compter que les séquences de trades avec stratégie définie
        currentConsecutiveRespected = 0;
        currentConsecutiveNotRespected = 0;
      }
    });
    
    return {
      totalTrades,
      totalPnl,
      profitFactor,
      totalFees,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      maxConsecutiveRespected,
      maxConsecutiveNotRespected,
    };
  }, [trades, strategies]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Compte de trading
            </label>
            <AccountSelector value={accountId} onChange={setAccountId} hideLabel />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Année
            </label>
            <select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Toutes les années</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mois
            </label>
            <select
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!selectedYear}
            >
              <option value="">Tous les mois</option>
              {availableMonths.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedYear(null);
                setSelectedMonth(null);
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Graphiques */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique 1: Métriques de trading (jauges circulaires) */}
          {tradingMetrics && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Trader Performance Tracker</h2>
                <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Objectifs basés sur vos performances historiques</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Jauge Win Rate */}
                <div className="flex flex-col items-center bg-gray-100 rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 mb-4 text-center uppercase tracking-wide">
                    Win Rate
                  </h3>
                  <div className="relative w-[140px] h-[140px] mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg width="140" height="140" className="transform -rotate-90 absolute top-0 left-0">
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#d1d5db"
                        strokeWidth="8"
                        fill="none"
                        className="opacity-40"
                      />
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke={performanceLabels?.winRate.color || '#10b981'}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 66}
                        strokeDashoffset={2 * Math.PI * 66 * (1 - Math.min(tradingMetrics.winRate / 100, 1))}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {tradingMetrics.winRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 text-center leading-relaxed mb-3">
                    Objectif: {gaugeObjectives?.winRate}%
                  </div>
                  <div className="mt-2 px-2 py-1 rounded-full text-xs font-medium" style={{ 
                    backgroundColor: performanceLabels?.winRate.bgColor,
                    color: performanceLabels?.winRate.color
                  }}>
                    {performanceLabels?.winRate.label}
                  </div>
                </div>

                {/* Jauge Avg Winning Trade */}
                <div className="flex flex-col items-center bg-gray-100 rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 mb-4 text-center uppercase tracking-wide">
                    Avg Gagnant
                  </h3>
                  <div className="relative w-[140px] h-[140px] mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg width="140" height="140" className="transform -rotate-90 absolute top-0 left-0">
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#d1d5db"
                        strokeWidth="8"
                        fill="none"
                        className="opacity-40"
                      />
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#10b981"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 66}
                        strokeDashoffset={2 * Math.PI * 66 * (1 - Math.min(tradingMetrics.avgWinningTrade / gaugeMaxValues.avgWinning, 1))}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <div className="text-sm font-bold text-gray-900 text-center px-2">
                        {formatCurrency(tradingMetrics.avgWinningTrade, currencySymbol)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 text-center leading-relaxed mb-3">
                    Objectif: {formatCurrency(gaugeObjectives?.avgWinning || 0, currencySymbol)}
                  </div>
                  <div className="mt-2 px-2 py-1 rounded-full text-xs font-medium" style={{ 
                    backgroundColor: performanceLabels?.avgWinning.bgColor,
                    color: performanceLabels?.avgWinning.color
                  }}>
                    {performanceLabels?.avgWinning.label}
                  </div>
                </div>

                {/* Jauge Avg Losing Trade */}
                <div className="flex flex-col items-center bg-gray-100 rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 mb-4 text-center uppercase tracking-wide">
                    Avg Perdant
                  </h3>
                  <div className="relative w-[140px] h-[140px] mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg width="140" height="140" className="transform -rotate-90 absolute top-0 left-0">
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#d1d5db"
                        strokeWidth="8"
                        fill="none"
                        className="opacity-40"
                      />
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#ef4444"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 66}
                        strokeDashoffset={2 * Math.PI * 66 * (1 - Math.min(Math.abs(tradingMetrics.avgLosingTrade) / gaugeMaxValues.avgLosing, 1))}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <div className="text-sm font-bold text-gray-900 text-center px-2">
                        {formatCurrency(Math.abs(tradingMetrics.avgLosingTrade), currencySymbol)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 text-center leading-relaxed mb-3">
                    Objectif: &lt; {formatCurrency(gaugeObjectives?.avgLosing || 0, currencySymbol)}
                  </div>
                  <div className="mt-2 px-2 py-1 rounded-full text-xs font-medium" style={{ 
                    backgroundColor: performanceLabels?.avgLosing.bgColor,
                    color: performanceLabels?.avgLosing.color
                  }}>
                    {performanceLabels?.avgLosing.label}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cartes de statistiques à droite */}
          {additionalStats && tradingMetrics && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <ModernStatCard
                label="P/L Total"
                value={formatCurrency(additionalStats.totalPnl, currencySymbol)}
                variant={additionalStats.totalPnl >= 0 ? 'success' : 'danger'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                trend={additionalStats.totalPnl >= 0 ? 'up' : 'down'}
                trendValue={additionalStats.totalPnl >= 0 ? 'Rentable' : 'Perdant'}
              />
              
              <ModernStatCard
                label="Profit Factor"
                value={additionalStats.profitFactor.toFixed(2)}
                variant={additionalStats.profitFactor >= 1.5 ? 'success' : additionalStats.profitFactor >= 1 ? 'warning' : 'danger'}
                size="small"
                icon={
                  additionalStats.profitFactor >= 1 ? (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                  ) : (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.306-4.307a11.95 11.95 0 015.814 5.519l2.74 1.22m0 0l-5.94 2.28m5.94-2.28l2.28-5.941" />
                    </svg>
                  )
                }
                trend={additionalStats.profitFactor >= 1 ? 'up' : 'down'}
                trendValue={additionalStats.profitFactor >= 1.5 ? 'Excellent' : additionalStats.profitFactor >= 1 ? 'Bon' : 'À améliorer'}
              />
              
              <ModernStatCard
                label="Ratio W/L"
                value={tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 ? (Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade)).toFixed(2) : '0.00'}
                variant={tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 && Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade) >= 2 ? 'success' : tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 && Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade) >= 1.5 ? 'warning' : 'info'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.036-.177-2.032-.498-2.96" />
                  </svg>
                }
                trend={undefined}
                trendValue={`Avg: ${formatCurrency(Math.abs(tradingMetrics.avgWinningTrade), currencySymbol)} / ${formatCurrency(Math.abs(tradingMetrics.avgLosingTrade), currencySymbol)}`}
              />
              
              <ModernStatCard
                label="Frais Totaux"
                value={formatCurrency(additionalStats.totalFees, currencySymbol)}
                variant="warning"
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                }
                trend={undefined}
                trendValue={Math.abs(additionalStats.totalPnl) > 0 ? `${((additionalStats.totalFees / Math.abs(additionalStats.totalPnl)) * 100).toFixed(1)}% du P/L` : 'N/A'}
              />
              
              <ModernStatCard
                label="Séquence Respect"
                value={additionalStats.maxConsecutiveRespected || 0}
                variant={additionalStats.maxConsecutiveRespected >= 5 ? 'success' : additionalStats.maxConsecutiveRespected >= 3 ? 'info' : 'default'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                trend={additionalStats.maxConsecutiveRespected >= 3 ? 'up' : additionalStats.maxConsecutiveRespected > 0 ? 'neutral' : undefined}
                trendValue={additionalStats.maxConsecutiveRespected > 0 ? `Max: ${additionalStats.maxConsecutiveRespected} trades` : 'Pas de données'}
              />
              
              <ModernStatCard
                label="Séquence Non-Respect"
                value={additionalStats.maxConsecutiveNotRespected || 0}
                variant={additionalStats.maxConsecutiveNotRespected >= 5 ? 'danger' : additionalStats.maxConsecutiveNotRespected >= 3 ? 'warning' : 'default'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                }
                trend={additionalStats.maxConsecutiveNotRespected >= 3 ? 'down' : additionalStats.maxConsecutiveNotRespected > 0 ? 'neutral' : undefined}
                trendValue={additionalStats.maxConsecutiveNotRespected > 0 ? `Max: ${additionalStats.maxConsecutiveNotRespected} trades` : 'Pas de données'}
              />
            </div>
          )}

          {/* Graphique 2: Solde du compte dans le temps */}
          {accountBalanceData.length > 0 && accountBalanceChartData && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${performanceStats.isPositive ? 'bg-blue-100' : 'bg-pink-100'}`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path 
                          d="M4 16l4-5 3 3 5-7 4 6" 
                          stroke={performanceStats.isPositive ? '#3b82f6' : '#ec4899'} 
                          strokeWidth="2" 
                          fill="none" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">SOLDE DU COMPTE DANS LE TEMPS</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Start Date Picker */}
                    <div className="relative">
                      <div className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-600 z-10">
                        Date début
                      </div>
                      <input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value || defaultStartDate)}
                        onBlur={(e) => {
                          if (!e.target.value) {
                            setStartDate(defaultStartDate);
                          }
                        }}
                        className="px-4 py-2.5 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min={defaultStartDate}
                        max={defaultEndDate}
                      />
                    </div>
                    
                    {/* Hyphen */}
                    <span className="text-gray-500 text-xl font-medium">-</span>

                    {/* End Date Picker */}
                    <div className="relative">
                      <div className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-600 z-10">
                        Date fin
                      </div>
                      <input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value || defaultEndDate)}
                        onBlur={(e) => {
                          if (!e.target.value) {
                            setEndDate(defaultEndDate);
                          }
                        }}
                        className="px-4 py-2.5 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min={defaultStartDate}
                        max={defaultEndDate}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 ml-11">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {performanceStats.totalReturn >= 0 ? 'Gain' : 'Perte'} total :
                    </span>
                    <span className={`text-lg font-bold ${performanceStats.totalReturn >= 0 ? 'text-blue-600' : 'text-pink-600'}`}>
                      {formatCurrency(performanceStats.totalReturn, currencySymbol)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span>Plus haut :</span>
                      <span className={`font-medium ${performanceStats.highestValue >= 0 ? 'text-blue-600' : 'text-pink-600'}`}>
                        {formatCurrency(performanceStats.highestValue || 0, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Plus bas :</span>
                      <span className={`font-medium ${performanceStats.lowestValue >= 0 ? 'text-blue-600' : 'text-pink-600'}`}>
                        {formatCurrency(performanceStats.lowestValue || 0, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-80">
                {filteredBalanceData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Aucune donnée dans la période sélectionnée
                  </div>
                ) : (
                  <ChartLine
                    key={`chart-${performanceStats.totalReturn}`}
                    data={{
                      labels: accountBalanceChartData.labels,
                      datasets: [
                        {
                          label: 'Solde positif',
                          data: accountBalanceChartData.positiveValues,
                          borderColor: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          borderWidth: 3,
                          fill: true,
                          tension: 0.4,
                          pointRadius: (context: any) => {
                            const value = context.parsed.y;
                            return value !== null && value !== undefined ? 4 : 0;
                          },
                          pointBackgroundColor: '#3b82f6',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2,
                          pointHoverRadius: 6,
                          pointHoverBackgroundColor: '#2563eb',
                          pointHoverBorderColor: '#ffffff',
                          pointHoverBorderWidth: 3,
                          spanGaps: false,
                        },
                        {
                          label: 'Solde négatif',
                          data: accountBalanceChartData.negativeValues,
                          borderColor: '#ec4899',
                          backgroundColor: 'rgba(236, 72, 153, 0.2)',
                          borderWidth: 3,
                          fill: true,
                          tension: 0.4,
                          pointRadius: (context: any) => {
                            const value = context.parsed.y;
                            return value !== null && value !== undefined ? 4 : 0;
                          },
                          pointBackgroundColor: '#ec4899',
                          pointBorderColor: '#ffffff',
                          pointBorderWidth: 2,
                          pointHoverRadius: 6,
                          pointHoverBackgroundColor: '#db2777',
                          pointHoverBorderColor: '#ffffff',
                          pointHoverBorderWidth: 3,
                          spanGaps: false,
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
                          mode: 'index' as const,
                          intersect: false,
                          callbacks: {
                            title: function(context: any) {
                              return accountBalanceChartData.labels[context[0].dataIndex] || '';
                            },
                            label: function(context: any) {
                              const value = context.parsed.y || 0;
                              const index = context.dataIndex;
                              // Utiliser le mapping pour trouver le PnL
                              const pnl = accountBalanceChartData.pnlMapping[index] ?? 0;
                              return [
                                `Solde: ${formatCurrency(value, currencySymbol)}`,
                                `PnL jour: ${formatCurrency(pnl, currencySymbol)}`,
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
                            text: 'Solde',
                            color: '#4b5563',
                            font: {
                              size: 13,
                              weight: 600,
                            },
                          },
                        },
                      },
                      animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart' as const,
                      },
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Graphique 4: Performance par jour de la semaine */}
          {weekdayPerformanceData.length > 0 && weekdayChartData && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Performance par Jour de la Semaine</h3>
                </div>
                {weekdayStats && (
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-2">
                    <div className="flex items-center gap-1">
                      <span>Plus actif :</span>
                      <span className="font-medium text-blue-500">{weekdayStats.mostActiveDay.day} ({weekdayStats.mostActiveDay.trade_count} trades)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Moins actif :</span>
                      <span className="font-medium text-pink-500">{weekdayStats.worstDay.day} ({weekdayStats.worstDay.trade_count} trades)</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-80">
                <ChartBar
                  data={weekdayChartData}
                  plugins={[{
                    id: 'adjustAxis',
                    beforeUpdate: (chart: any) => {
                      // Ajuster les limites de l'axe Y après le calcul initial
                      const yScale = chart.scales.y;
                      if (yScale && weekdayYAxisLimits) {
                        // Forcer les limites calculées
                        yScale.min = weekdayYAxisLimits.min;
                        yScale.max = weekdayYAxisLimits.max;
                      }
                    }
                  }]}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
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
                          label: function(context: any) {
                            const index = context.dataIndex;
                            const value = context.parsed.y;
                            const dayData = weekdayPerformanceData[index];
                            
                            return [
                              `PnL Total: ${formatCurrency(value, currencySymbol)}`,
                              `Nombre de trades: ${dayData.trade_count}`,
                              `Taux de réussite: ${dayData.win_rate.toFixed(1)}%`
                            ];
                          }
                        }
                      },
                      datalabels: {
                        display: true,
                        anchor: 'end' as const,
                        align: 'top' as const,
                        color: function(context: any) {
                          const value = context.parsed?.y || context.raw;
                          return value >= 0 ? '#3b82f6' : '#ec4899';
                        },
                        font: {
                          size: 12,
                          weight: 600 as const
                        },
                        formatter: function(value: any, context: any) {
                          const actualValue = context.parsed?.y || value;
                          return formatCurrency(actualValue, currencySymbol);
                        }
                      }
                    },
                    scales: {
                      x: {
                        grid: {
                          display: false
                        },
                        ticks: {
                          color: '#6b7280',
                          font: {
                            size: 12
                          }
                        },
                        border: {
                          color: '#d1d5db',
                        },
                        title: {
                          display: false,
                        },
                      },
                      y: {
                        type: 'linear' as const,
                        display: true,
                        position: 'left' as const,
                        beginAtZero: false,
                        min: weekdayYAxisLimits.min,
                        max: weekdayYAxisLimits.max,
                        grid: {
                          color: function(context: any) {
                            // Mettre en évidence la ligne à y=0 avec une couleur plus foncée
                            if (Math.abs(context.tick.value) < 0.0001) {
                              return '#9ca3af';
                            }
                            return '#e5e7eb';
                          },
                          lineWidth: 1,
                        },
                        ticks: {
                          callback: function(value: any) {
                            return formatCurrency(value, currencySymbol);
                          },
                          color: '#6b7280',
                          font: {
                            size: 11
                          },
                          // Utiliser le stepSize calculé pour des valeurs cohérentes
                          stepSize: weekdayYAxisLimits.stepSize,
                          maxTicksLimit: 10,
                          padding: 5,
                        },
                        border: {
                          color: '#d1d5db',
                          display: false,
                        },
                      }
                    },
                    animation: {
                      duration: 1000,
                      easing: 'easeInOutQuart' as const
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Graphique 5: Waterfall des gains et pertes journalière */}
          {waterfallData.length > 0 && waterfallChartData && (
            <div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Évolution des Gains et Pertes Journalière</h3>
                  </div>
                  {waterfallStats && (
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        <span>Capital total :</span>
                        <span className={`font-medium ${waterfallStats.totalPnl >= 0 ? 'text-blue-500' : 'text-pink-500'}`}>
                          {formatCurrency(waterfallStats.totalPnl, currencySymbol)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Meilleur jour :</span>
                        <span className="font-medium text-blue-500">{formatCurrency(waterfallStats.bestDay, currencySymbol)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Pire jour :</span>
                        <span className="font-medium text-pink-500">{formatCurrency(waterfallStats.worstDay, currencySymbol)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Jours gagnants :</span>
                        <span className="font-medium text-gray-700">{waterfallStats.positiveDays}/{waterfallData.length} ({waterfallStats.winRate.toFixed(1)}%)</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-[420px]">
                  <ChartBar
                    data={waterfallChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false
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
                            label: function(context: any) {
                              const index = context.dataIndex;
                              const waterfallBarData = context.dataset._waterfallData[index];
                              const pnl = waterfallBarData.value;
                              const cumulative = waterfallBarData.cumulative;
                              const start = waterfallBarData.start;
                              
                              return [
                                `PnL du jour: ${formatCurrency(pnl, currencySymbol)}`,
                                `Capital cumulé: ${formatCurrency(cumulative, currencySymbol)}`,
                                `Variation: ${formatCurrency(cumulative - start, currencySymbol)}`
                              ];
                            }
                          }
                        },
                        datalabels: {
                          display: false
                        }
                      },
                      scales: {
                        x: {
                          grid: {
                            display: false
                          },
                          ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            color: '#6b7280',
                            font: {
                              size: 11
                            }
                          },
                          border: {
                            color: '#d1d5db',
                          },
                        },
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: '#e5e7eb',
                            lineWidth: 1,
                          },
                          ticks: {
                            callback: function(value: any) {
                              return formatCurrency(value, currencySymbol);
                            },
                            color: '#6b7280',
                            font: {
                              size: 11
                            }
                          },
                          border: {
                            color: '#d1d5db',
                            display: false,
                          },
                        }
                      },
                      elements: {
                        bar: {
                          borderRadius: 0,
                          borderSkipped: false
                        }
                      },
                      animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart' as const
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Graphique 6: Répartition des trades par durée */}
          {durationDistributionBins.length > 0 && (
            <DurationDistributionChart bins={durationDistributionBins} />
          )}
        </div>
      )}

      {!isLoading && accountBalanceData.length === 0 && !durationDistribution.some(d => d.total > 0) && waterfallData.length === 0 && weekdayPerformanceData.length === 0 && !tradingMetrics && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
          <p>Aucune donnée disponible pour la période sélectionnée.</p>
        </div>
      )}

      <FloatingActionButton onClick={() => setShowImport(true)} title="Importer des trades" />
      <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
};

export default DashboardPage;
