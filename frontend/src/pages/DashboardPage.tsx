import React, { useState, useEffect, useMemo } from 'react';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { CustomSelect } from '../components/common/CustomSelect';
import { User } from '../services/auth';
import { tradesService, TradeListItem } from '../services/trades';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { tradeStrategiesService, TradeStrategy } from '../services/tradeStrategies';
import ModernStatCard from '../components/common/ModernStatCard';
import DurationDistributionChart from '../components/charts/DurationDistributionChart';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency as formatCurrencyUtil } from '../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/TradingAccountContext';
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
  metricType: 'winRate' | 'avgWinning' | 'avgLosing',
  t: (key: string) => string
): { label: string; color: string; bgColor: string; borderColor: string } => {
  let percentage: number;
  let color: string;
  let label: string;
  
  if (metricType === 'winRate') {
    // Pour winRate, utiliser des seuils absolus fixes
    // Standards du trading : 60%+ excellent, 50%+ bon, 40%+ moyen, <40% à améliorer
    if (currentValue >= 60) {
      label = t('dashboard:excellent');
      color = '#10b981'; // green
    } else if (currentValue >= 50) {
      label = t('dashboard:good');
      color = '#10b981'; // green
    } else if (currentValue >= 40) {
      label = t('dashboard:average');
      color = '#f59e0b'; // orange
    } else {
      label = t('dashboard:needsImprovement');
      color = '#ef4444'; // red
    }
  } else if (metricType === 'avgLosing') {
    // Pour avgLosing, on veut un montant FAIBLE, donc on inverse la logique
    // Plus c'est bas par rapport à l'objectif, mieux c'est
    percentage = (1 - Math.min(currentValue / objective, 1)) * 100;
    
    if (percentage >= 90) {
      label = t('dashboard:excellent');
      color = '#10b981'; // green
    } else if (percentage >= 70) {
      label = t('dashboard:veryGood');
      color = '#10b981'; // green
    } else if (percentage >= 50) {
      label = t('dashboard:good');
      color = '#f59e0b'; // orange
    } else if (percentage >= 30) {
      label = t('dashboard:average');
      color = '#f59e0b'; // orange
    } else {
      label = t('dashboard:needsImprovement');
      color = '#ef4444'; // red
    }
  } else {
    // Pour avgWinning, plus c'est haut par rapport à l'objectif, mieux c'est
    percentage = Math.min((currentValue / objective) * 100, 100);
    
    if (percentage >= 90) {
      label = t('dashboard:excellent');
      color = '#10b981'; // green
    } else if (percentage >= 70) {
      label = t('dashboard:veryGood');
      color = '#10b981'; // green
    } else if (percentage >= 50) {
      label = t('dashboard:good');
      color = '#f59e0b'; // orange
    } else if (percentage >= 30) {
      label = t('dashboard:average');
      color = '#f59e0b'; // orange
    } else {
      label = t('dashboard:needsImprovement');
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
  const { theme } = useTheme();
  const { t } = useI18nTranslation();
  const isDark = theme === 'dark';
  const [showImport, setShowImport] = useState(false);
  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId } = useTradingAccount();
  
  // Wrapper pour formatCurrency avec préférences
  const formatCurrency = (value: number, currencySymbol: string = ''): string => {
    return formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2);
  };
  const [selectedYear, setSelectedYear] = useState<number | null>(new Date().getFullYear());
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
  const yearOptions = useMemo(() => [
    { value: null, label: t('dashboard:allYears') },
    ...availableYears.map(year => ({ value: year, label: year.toString() }))
  ], [availableYears, t]);
  
  const monthOptions = useMemo(() => {
    const availableMonths = [
      { value: 1, label: t('dashboard:january') },
      { value: 2, label: t('dashboard:february') },
      { value: 3, label: t('dashboard:march') },
      { value: 4, label: t('dashboard:april') },
      { value: 5, label: t('dashboard:may') },
      { value: 6, label: t('dashboard:june') },
      { value: 7, label: t('dashboard:july') },
      { value: 8, label: t('dashboard:august') },
      { value: 9, label: t('dashboard:september') },
      { value: 10, label: t('dashboard:october') },
      { value: 11, label: t('dashboard:november') },
      { value: 12, label: t('dashboard:december') },
    ];
    return [
      { value: null, label: t('dashboard:allMonths') },
      ...availableMonths.map(month => ({ value: month.value, label: month.label }))
    ];
  }, [t]);

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
      } catch (err: any) {
        // Si le compte n'existe pas (404) ou n'appartient pas à l'utilisateur, réinitialiser
        if (err?.status === 404) {
          console.warn('Le compte sélectionné n\'existe plus, réinitialisation...');
          setAccountId(null); // Réinitialiser le compte sélectionné dans le contexte
        } else {
          console.error('Erreur lors du chargement du compte', err);
        }
        setSelectedAccount(null);
      }
    };
    loadAccount();
  }, [accountId, setAccountId]);

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
          // Utiliser une limite raisonnable : 10000 par défaut, ou plus si une année spécifique est sélectionnée
          page_size: selectedYear ? 10000 : 5000, // Limiter pour éviter les timeouts
        };

        // Ajouter le filtre de date selon l'année et le mois
        if (selectedYear) {
          const startDate = selectedMonth 
            ? `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`
            : `${selectedYear}-01-01`;
          
          let endDate: string;
          if (selectedMonth) {
            // Calculer le dernier jour du mois sélectionné
            // selectedMonth est 1-12, donc on utilise selectedMonth comme index (1=janvier devient mois 1 en JS = février)
            // Le jour 0 du mois suivant donne le dernier jour du mois actuel
            const lastDay = new Date(selectedYear, selectedMonth, 0);
            const year = lastDay.getFullYear();
            const month = String(lastDay.getMonth() + 1).padStart(2, '0');
            const day = String(lastDay.getDate()).padStart(2, '0');
            endDate = `${year}-${month}-${day}`;
          } else {
            endDate = `${selectedYear}-12-31`;
          }
          
          filters.start_date = startDate;
          filters.end_date = endDate;
        }

        // Ajouter un timeout pour éviter les chargements infinis
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout: La requête a pris trop de temps')), 60000); // 60 secondes
        });

        const response = await Promise.race([
          tradesService.list(filters),
          timeoutPromise
        ]);
        
        // Filtrer par année/mois côté client aussi pour être sûr
        let filteredTrades = response.results;
        if (selectedYear) {
          filteredTrades = filteredTrades.filter(trade => {
            // Utiliser trade_day si disponible, sinon entered_at comme fallback
            const dateStr = trade.trade_day || trade.entered_at;
            if (!dateStr) return false;
            
            const tradeDate = new Date(dateStr);
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

        // Charger les stratégies de manière asynchrone (non bloquant)
        // pour ne pas ralentir l'affichage initial des données
        (async () => {
          const strategiesMap = new Map<number, TradeStrategy>();
          try {
            // Récupérer toutes les dates uniques des trades
            const uniqueDates = new Set<string>();
            filteredTrades.forEach(trade => {
              if (trade.trade_day) {
                uniqueDates.add(trade.trade_day);
              }
            });

            // Limiter le nombre de dates à traiter pour éviter trop de requêtes
            // Si trop de dates, on limite à un échantillon raisonnable
            const datesArray = Array.from(uniqueDates).slice(0, 365); // Max 1 an de dates
            
            // Charger les stratégies en parallèle (batch de 10 à la fois pour éviter de surcharger)
            const batchSize = 10;
            for (let i = 0; i < datesArray.length; i += batchSize) {
              const batch = datesArray.slice(i, i + batchSize);
              await Promise.all(
                batch.map(async (date) => {
                  try {
                    const dateStrategies = await tradeStrategiesService.byDate(date, accountId ?? undefined);
                    dateStrategies.forEach(strategy => {
                      // strategy.trade est l'ID numérique du trade TopStepTrade
                      strategiesMap.set(strategy.trade, strategy);
                    });
                  } catch (e) {
                    // Ignorer les erreurs pour les dates sans stratégies
                  }
                })
              );
            }
          } catch (err) {
            console.error('Erreur lors du chargement des stratégies', err);
          }

          setStrategies(strategiesMap);
        })();
      } catch (err) {
        setError(t('dashboard:error'));
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrades();
  }, [accountId, selectedYear, selectedMonth, t]);

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
    // Calculer la perte/gain total : somme des PnL de la période filtrée
    // C'est plus fiable car cela représente exactement la variation pendant la période sélectionnée
    const totalReturn = filteredBalanceData.reduce((sum, d) => sum + d.pnl, 0);
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
      new Date(d.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', timeZone: preferences.timezone })
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
  }, [filteredBalanceData, performanceStats, preferences.timezone]);

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
        date: new Date(date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', timeZone: preferences.timezone }),
        pnl: dailyPnl,
        cumulative: cumulativeBalance,
        is_positive: dailyPnl >= 0,
      };
    });
  }, [trades, preferences.timezone]);

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
          label: t('dashboard:capitalEvolution'),
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
  }, [waterfallData, t]);

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
    const monday = t('dashboard:monday');
    const tuesday = t('dashboard:tuesday');
    const wednesday = t('dashboard:wednesday');
    const thursday = t('dashboard:thursday');
    const friday = t('dashboard:friday');
    const saturday = t('dashboard:saturday');
    const sunday = t('dashboard:sunday');
    
    const dayStats: { [day: string]: { total_pnl: number; trade_count: number; winning_trades: number } } = {
      [monday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [tuesday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [wednesday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [thursday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [friday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [saturday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [sunday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
    };

    const dayNames = [sunday, monday, tuesday, wednesday, thursday, friday, saturday];

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
      .filter(d => d.day !== t('dashboard:saturday') && d.day !== t('dashboard:sunday')); // Filtrer les weekends
  }, [trades, t]);

  // Préparer les données pour le graphique de performance par jour
  const weekdayChartData = useMemo(() => {
    if (weekdayPerformanceData.length === 0) return null;

    const labels = weekdayPerformanceData.map(d => d.day);
    const totalPnlValues = weekdayPerformanceData.map(d => d.total_pnl);

    return {
      labels,
      datasets: [
        {
          label: t('dashboard:pnlTotal'),
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
  }, [weekdayPerformanceData, t]);

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
      day.total_pnl < min.total_pnl ? day : min, 
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
      winRate: getPerformanceLabel(tradingMetrics.winRate, gaugeObjectives.winRate, 'winRate', t),
      avgWinning: getPerformanceLabel(tradingMetrics.avgWinningTrade, gaugeObjectives.avgWinning, 'avgWinning', t),
      avgLosing: getPerformanceLabel(Math.abs(tradingMetrics.avgLosingTrade), gaugeObjectives.avgLosing, 'avgLosing', t),
    };
  }, [tradingMetrics, gaugeObjectives, t]);

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

  // Helper function pour obtenir les couleurs selon le thème
  const chartColors = useMemo(() => ({
    text: isDark ? '#d1d5db' : '#374151',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    background: isDark ? '#1f2937' : '#ffffff',
    grid: isDark ? '#374151' : '#e5e7eb',
    border: isDark ? '#4b5563' : '#d1d5db',
    tooltipBg: isDark ? '#374151' : '#ffffff',
    tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
  }), [isDark]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Filtres */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard:tradingAccount')}
            </label>
            <AccountSelector value={accountId} onChange={setAccountId} hideLabel />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard:year')}
            </label>
            <CustomSelect
              value={selectedYear}
              onChange={(value) => setSelectedYear(value as number | null)}
              options={yearOptions}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard:month')}
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
              {t('dashboard:reset')}
            </button>
          </div>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Graphiques */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">{t('dashboard:loading')}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique 1: Métriques de trading (jauges circulaires) */}
          {tradingMetrics && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{t('dashboard:traderPerformanceTracker')}</h2>
                <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('dashboard:objectivesBasedOnHistory')}</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Jauge Win Rate */}
                <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-600 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center uppercase tracking-wide">
                    {t('dashboard:winRate')}
                  </h3>
                  <div className="relative w-[140px] h-[140px] mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
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
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {tradingMetrics.winRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed mb-3">
                    {t('dashboard:objective')}: {gaugeObjectives?.winRate}%
                  </div>
                  <div className="mt-2 px-2 py-1 rounded-full text-xs font-medium" style={{ 
                    backgroundColor: performanceLabels?.winRate.bgColor,
                    color: performanceLabels?.winRate.color
                  }}>
                    {performanceLabels?.winRate.label}
                  </div>
                </div>

                {/* Jauge Avg Winning Trade */}
                <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-600 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center uppercase tracking-wide">
                    {t('dashboard:avgWinning')}
                  </h3>
                  <div className="relative w-[140px] h-[140px] mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
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
                      <div className="text-sm font-bold text-gray-900 dark:text-gray-100 text-center px-2">
                        {formatCurrency(tradingMetrics.avgWinningTrade, currencySymbol)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed mb-3">
                    {t('dashboard:objective')}: {formatCurrency(gaugeObjectives?.avgWinning || 0, currencySymbol)}
                  </div>
                  <div className="mt-2 px-2 py-1 rounded-full text-xs font-medium" style={{ 
                    backgroundColor: performanceLabels?.avgWinning.bgColor,
                    color: performanceLabels?.avgWinning.color
                  }}>
                    {performanceLabels?.avgWinning.label}
                  </div>
                </div>

                {/* Jauge Avg Losing Trade */}
                <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-4 shadow-md border border-gray-200 dark:border-gray-600 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center uppercase tracking-wide">
                    {t('dashboard:avgLosing')}
                  </h3>
                  <div className="relative w-[140px] h-[140px] mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
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
                      <div className="text-sm font-bold text-gray-900 dark:text-gray-100 text-center px-2">
                        {formatCurrency(Math.abs(tradingMetrics.avgLosingTrade), currencySymbol)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 text-center leading-relaxed mb-3">
                    {t('dashboard:objective')}: &lt; {formatCurrency(gaugeObjectives?.avgLosing || 0, currencySymbol)}
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
                label={t('dashboard:totalPnL')}
                value={formatCurrency(additionalStats.totalPnl, currencySymbol)}
                variant={additionalStats.totalPnl >= 0 ? 'success' : 'danger'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                trend={additionalStats.totalPnl >= 0 ? 'up' : 'down'}
                trendValue={additionalStats.totalPnl >= 0 ? t('dashboard:profitable') : t('dashboard:losing')}
              />
              
              <ModernStatCard
                label={t('dashboard:profitFactor')}
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
                trendValue={additionalStats.profitFactor >= 1.5 ? t('dashboard:excellent') : additionalStats.profitFactor >= 1 ? t('dashboard:good') : t('dashboard:needsImprovement')}
              />
              
              <ModernStatCard
                label={t('dashboard:wlRatio')}
                value={tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 ? (Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade)).toFixed(2) : '0.00'}
                variant={tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 && Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade) >= 2 ? 'success' : tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 && Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade) >= 1.5 ? 'warning' : 'info'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.036-.177-2.032-.498-2.96" />
                  </svg>
                }
                trend={undefined}
                trendValue={`${t('dashboard:avg')}: ${formatCurrency(Math.abs(tradingMetrics.avgWinningTrade), currencySymbol)} / ${formatCurrency(Math.abs(tradingMetrics.avgLosingTrade), currencySymbol)}`}
              />
              
              <ModernStatCard
                label={t('dashboard:totalFees')}
                value={formatCurrency(additionalStats.totalFees, currencySymbol)}
                variant="warning"
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                }
                trend={undefined}
                trendValue={Math.abs(additionalStats.totalPnl) > 0 ? `${((additionalStats.totalFees / Math.abs(additionalStats.totalPnl)) * 100).toFixed(1)}${t('dashboard:ofPnL')}` : t('common:na')}
              />
              
              <ModernStatCard
                label={t('dashboard:sequenceRespect')}
                value={additionalStats.maxConsecutiveRespected || 0}
                variant={additionalStats.maxConsecutiveRespected >= 5 ? 'success' : additionalStats.maxConsecutiveRespected >= 3 ? 'info' : 'default'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                trend={additionalStats.maxConsecutiveRespected >= 3 ? 'up' : additionalStats.maxConsecutiveRespected > 0 ? 'neutral' : undefined}
                trendValue={additionalStats.maxConsecutiveRespected > 0 ? `${t('dashboard:maxTrades')}: ${additionalStats.maxConsecutiveRespected} ${t('trades:trades')}` : t('dashboard:noDataAvailable')}
              />
              
              <ModernStatCard
                label={t('dashboard:sequenceNotRespect')}
                value={additionalStats.maxConsecutiveNotRespected || 0}
                variant={additionalStats.maxConsecutiveNotRespected >= 5 ? 'danger' : additionalStats.maxConsecutiveNotRespected >= 3 ? 'warning' : 'default'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                }
                trend={additionalStats.maxConsecutiveNotRespected >= 3 ? 'down' : additionalStats.maxConsecutiveNotRespected > 0 ? 'neutral' : undefined}
                trendValue={additionalStats.maxConsecutiveNotRespected > 0 ? `${t('dashboard:maxTrades')}: ${additionalStats.maxConsecutiveNotRespected} ${t('trades:trades')}` : t('dashboard:noDataAvailable')}
              />
            </div>
          )}

          {/* Graphique 2: Solde du compte dans le temps */}
          {accountBalanceData.length > 0 && accountBalanceChartData && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('dashboard:accountBalanceOverTime')}</h3>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {performanceStats.totalReturn >= 0 ? t('dashboard:totalGain') : t('dashboard:totalLoss')} :
                        </span>
                        <span className={`text-lg font-bold ${performanceStats.totalReturn >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}`}>
                          {formatCurrency(performanceStats.totalReturn, currencySymbol)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <span>{t('dashboard:highest')} :</span>
                          <span className={`font-medium ${performanceStats.highestValue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}`}>
                            {formatCurrency(performanceStats.highestValue || 0, currencySymbol)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{t('dashboard:lowest')} :</span>
                          <span className={`font-medium ${performanceStats.lowestValue >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}`}>
                            {formatCurrency(performanceStats.lowestValue || 0, currencySymbol)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {/* Start Date Picker */}
                    <div className="relative">
                      <div className="absolute -top-2 left-3 bg-white dark:bg-gray-800 px-1 text-xs font-medium text-gray-600 dark:text-gray-400 z-10">
                        {t('dashboard:startDate')}
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
                        className="px-4 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        min={defaultStartDate}
                        max={defaultEndDate}
                      />
                    </div>
                    
                    {/* Hyphen */}
                    <span className="text-gray-500 dark:text-gray-400 text-xl font-medium">-</span>

                    {/* End Date Picker */}
                    <div className="relative">
                      <div className="absolute -top-2 left-3 bg-white dark:bg-gray-800 px-1 text-xs font-medium text-gray-600 dark:text-gray-400 z-10">
                        {t('dashboard:endDate')}
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
                        className="px-4 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        min={defaultStartDate}
                        max={defaultEndDate}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-80">
                {filteredBalanceData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                    {t('dashboard:noDataInPeriod')}
                  </div>
                ) : (
                  <ChartLine
                    key={`chart-${performanceStats.totalReturn}`}
                    data={{
                      labels: accountBalanceChartData.labels,
                      datasets: [
                        {
                          label: t('dashboard:positiveBalance'),
                          data: accountBalanceChartData.positiveValues,
                          borderColor: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          borderWidth: 3,
                          fill: true,
                          tension: 0.4,
                          pointRadius: (context: any) => {
                            // Masquer les points si trop de données (> 100 points)
                            const dataLength = accountBalanceChartData.labels.length;
                            if (dataLength > 100) return 0;
                            // Vérifier que context.parsed existe avant d'accéder à y
                            const value = context.parsed?.y;
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
                          label: t('dashboard:negativeBalance'),
                          data: accountBalanceChartData.negativeValues,
                          borderColor: '#ec4899',
                          backgroundColor: 'rgba(236, 72, 153, 0.2)',
                          borderWidth: 3,
                          fill: true,
                          tension: 0.4,
                          pointRadius: (context: any) => {
                            // Masquer les points si trop de données (> 100 points)
                            const dataLength = accountBalanceChartData.labels.length;
                            if (dataLength > 100) return 0;
                            // Vérifier que context.parsed existe avant d'accéder à y
                            const value = context.parsed?.y;
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
                          backgroundColor: chartColors.tooltipBg,
                          titleColor: chartColors.text,
                          bodyColor: chartColors.text,
                          borderColor: chartColors.tooltipBorder,
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
                                `${t('dashboard:balance')}: ${formatCurrency(value, currencySymbol)}`,
                                `${t('dashboard:dayPnLShort')}: ${formatCurrency(pnl, currencySymbol)}`,
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
                            color: chartColors.textSecondary,
                            font: {
                              size: 11,
                            },
                          },
                          grid: {
                            display: false,
                          },
                          border: {
                            color: chartColors.border,
                          },
                        },
                        y: {
                          beginAtZero: true,
                          ticks: {
                            color: chartColors.textSecondary,
                            font: {
                              size: 12,
                            },
                            callback: function(value) {
                              const numValue = typeof value === 'number' ? value : parseFloat(String(value));
                              return formatCurrency(numValue, currencySymbol);
                            },
                          },
                          grid: {
                            color: chartColors.grid,
                            lineWidth: 1,
                          },
                          border: {
                            color: chartColors.border,
                            display: false,
                          },
                          title: {
                            display: false,
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
          {weekdayPerformanceData.length > 0 && weekdayChartData && weekdayPerformanceData.some(d => d.trade_count > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('dashboard:weeklyPerformanceTitle')}</h3>
                </div>
                {weekdayStats && (
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <div className="flex items-center gap-1">
                      <span>{t('dashboard:mostActive')} :</span>
                      <span className="font-medium text-blue-500">{weekdayStats.mostActiveDay.day} ({weekdayStats.mostActiveDay.trade_count} {t('trades:trades')})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{t('dashboard:leastActive')} :</span>
                      <span className="font-medium text-pink-500">{weekdayStats.worstDay.day} ({weekdayStats.worstDay.trade_count} {t('trades:trades')})</span>
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
                        backgroundColor: chartColors.tooltipBg,
                        titleColor: chartColors.text,
                        bodyColor: chartColors.text,
                        borderColor: chartColors.tooltipBorder,
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
                              `${t('dashboard:pnlTotal')}: ${formatCurrency(value, currencySymbol)}`,
                              `${t('dashboard:numberOfTrades')}: ${dayData.trade_count}`,
                              `${t('dashboard:winRatePercentage')}: ${dayData.win_rate.toFixed(1)}%`
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
                            color: chartColors.textSecondary,
                          font: {
                            size: 12
                          }
                        },
                        border: {
                            color: chartColors.border,
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
                                return isDark ? '#6b7280' : '#9ca3af';
                            }
                              return chartColors.grid;
                          },
                          lineWidth: 1,
                        },
                        ticks: {
                          callback: function(value: any) {
                            return formatCurrency(value, currencySymbol);
                          },
                            color: chartColors.textSecondary,
                          font: {
                            size: 11
                          },
                          // Utiliser le stepSize calculé pour des valeurs cohérentes
                          stepSize: weekdayYAxisLimits.stepSize,
                          maxTicksLimit: 10,
                          padding: 5,
                        },
                        border: {
                            color: chartColors.border,
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('dashboard:dailyGainsLossesEvolution')}</h3>
                  </div>
                  {waterfallStats && (
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <div className="flex items-center gap-1">
                        <span>{t('dashboard:totalCapital')} :</span>
                        <span className={`font-medium ${waterfallStats.totalPnl >= 0 ? 'text-blue-500' : 'text-pink-500'}`}>
                          {formatCurrency(waterfallStats.totalPnl, currencySymbol)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{t('dashboard:bestDay')} :</span>
                        <span className="font-medium text-blue-500">{formatCurrency(waterfallStats.bestDay, currencySymbol)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{t('dashboard:worstDay')} :</span>
                        <span className="font-medium text-pink-500">{formatCurrency(waterfallStats.worstDay, currencySymbol)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{t('dashboard:winningDays')} :</span>
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
                          backgroundColor: chartColors.tooltipBg,
                          titleColor: chartColors.text,
                          bodyColor: chartColors.text,
                          borderColor: chartColors.tooltipBorder,
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
                                `${t('dashboard:dayPnL')}: ${formatCurrency(pnl, currencySymbol)}`,
                                `${t('dashboard:cumulativeCapital')}: ${formatCurrency(cumulative, currencySymbol)}`,
                                `${t('dashboard:variation')}: ${formatCurrency(cumulative - start, currencySymbol)}`
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
                            color: chartColors.textSecondary,
                            font: {
                              size: 11
                            }
                          },
                          border: {
                            color: chartColors.border,
                          },
                        },
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: chartColors.grid,
                            lineWidth: 1,
                          },
                          ticks: {
                            callback: function(value: any) {
                              return formatCurrency(value, currencySymbol);
                            },
                            color: chartColors.textSecondary,
                            font: {
                              size: 11
                            }
                          },
                          border: {
                            color: chartColors.border,
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
          )}

          {/* Graphique 6: Répartition des trades par durée */}
          {durationDistributionBins.length > 0 && (
            <DurationDistributionChart bins={durationDistributionBins} />
          )}
        </div>
      )}

      {!isLoading && accountBalanceData.length === 0 && !durationDistribution.some(d => d.total > 0) && waterfallData.length === 0 && weekdayPerformanceData.length === 0 && !tradingMetrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-600 dark:text-gray-400">
          <p>{t('dashboard:noDataForPeriod')}</p>
        </div>
      )}

      <FloatingActionButton onClick={() => setShowImport(true)} title={t('dashboard:importTrades')} />
      <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
};

export default DashboardPage;
