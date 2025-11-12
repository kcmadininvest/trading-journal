import React, { useState, useEffect, useMemo } from 'react';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { DateInput } from '../components/common/DateInput';
import { PeriodSelector, PeriodRange } from '../components/common/PeriodSelector';
import { User } from '../services/auth';
import { tradesService, TradeListItem } from '../services/trades';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { tradeStrategiesService, TradeStrategy, StrategyComplianceStats } from '../services/tradeStrategies';
import { StrategyStreakCard } from '../components/strategy/StrategyStreakCard';
import { StrategyBadges } from '../components/strategy/StrategyBadges';
import { PerformanceComparison } from '../components/strategy/PerformanceComparison';
import { MetricGroup } from '../components/statistics/MetricGroup';
import ModernStatCard from '../components/common/ModernStatCard';
import DurationDistributionChart from '../components/charts/DurationDistributionChart';
import AccountBalanceChart from '../components/charts/AccountBalanceChart';
import Tooltip from '../components/ui/Tooltip';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountIndicatorsGrid } from '../components/common/AccountIndicatorsGrid';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar as ChartBar } from 'react-chartjs-2';

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  ChartLegend,
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
  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId, loading: accountLoading } = useTradingAccount();
  
  // Wrapper pour formatCurrency avec préférences
  const formatCurrency = (value: number, currencySymbol: string = ''): string => {
    return formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2);
  };
  
  // Wrapper pour formatNumber avec préférences
  const formatNumber = (value: number, digits: number = 2): string => {
    return formatNumberUtil(value, digits, preferences.number_format);
  };
  // Utiliser un sélecteur de période moderne au lieu de année/mois
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
  
  // Garder selectedYear et selectedMonth pour compatibilité avec le code existant
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  // État pour gérer la largeur de l'écran (responsive)
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [strategies, setStrategies] = useState<Map<number, TradeStrategy>>(new Map());
  // Données agrégées par jour (beaucoup plus rapide)
  const [dailyAggregates, setDailyAggregates] = useState<Array<{
    date: string;
    pnl: number;
    trade_count: number;
    winning_count: number;
    losing_count: number;
  }>>([]);
  // Trades et stratégies pour le calcul des séquences consécutives (sans filtres date)
  const [allTradesForSequences, setAllTradesForSequences] = useState<TradeListItem[]>([]);
  const [allStrategiesForSequences, setAllStrategiesForSequences] = useState<Map<number, TradeStrategy>>(new Map());
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [complianceStats, setComplianceStats] = useState<StrategyComplianceStats | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // Gérer le redimensionnement de la fenêtre pour le responsive
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

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

  // Charger les statistiques de compliance
  useEffect(() => {
    if (accountLoading) {
      return;
    }

    const loadComplianceStats = async () => {
      setComplianceLoading(true);
      try {
        const stats = await tradeStrategiesService.strategyComplianceStats(accountId ?? undefined);
        setComplianceStats(stats);
      } catch (err) {
        console.error('Erreur lors du chargement des statistiques de compliance', err);
        setComplianceStats(null);
      } finally {
        setComplianceLoading(false);
      }
    };

    loadComplianceStats();
  }, [accountId, accountLoading]);

  // Obtenir le symbole de devise
  const currencySymbol = useMemo(() => {
    if (!selectedAccount || !currencies.length) return '';
    const currency = currencies.find(c => c.code === selectedAccount.currency);
    return currency?.symbol || '';
  }, [selectedAccount, currencies]);

  // Charger les trades avec filtres
  useEffect(() => {
    // Attendre que le compte soit chargé avant de charger les données
    if (accountLoading) {
      return;
    }

    const loadTrades = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Utiliser la période sélectionnée (priorité) ou calculer depuis année/mois (rétrocompatibilité)
        let startDate: string;
        let endDate: string;
        
        if (selectedPeriod) {
          // Utiliser la période du sélecteur moderne
          startDate = selectedPeriod.start;
          endDate = selectedPeriod.end;
        } else if (selectedYear) {
          // Rétrocompatibilité avec l'ancien système année/mois
          const yearToLoad = selectedYear;
          startDate = selectedMonth 
            ? `${yearToLoad}-${selectedMonth.toString().padStart(2, '0')}-01`
            : `${yearToLoad}-01-01`;
          
          if (selectedMonth) {
            const lastDay = new Date(yearToLoad, selectedMonth, 0);
            const year = lastDay.getFullYear();
            const month = String(lastDay.getMonth() + 1).padStart(2, '0');
            const day = String(lastDay.getDate()).padStart(2, '0');
            endDate = `${year}-${month}-${day}`;
          } else {
            endDate = `${yearToLoad}-12-31`;
          }
        } else {
          // Par défaut: 3 derniers mois
          const now = new Date();
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          startDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
          endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }

        // CHARGER LES DONNÉES AGRÉGÉES PAR JOUR (beaucoup plus rapide)
        // Cela permet d'afficher les graphiques immédiatement
        const aggregatesResponse = await tradesService.dailyAggregates({
          trading_account: accountId ?? undefined,
          start_date: startDate,
          end_date: endDate,
        });
        
        setDailyAggregates(aggregatesResponse.results);
        
        // Charger les trades individuels seulement pour les statistiques détaillées
        // Limiter à 1000 trades max pour les statistiques
        const filters: any = {
          trading_account: accountId ?? undefined,
          page_size: 1000, // Limite réduite car on utilise les agrégats pour les graphiques
          start_date: startDate,
          end_date: endDate,
        };

        const response = await tradesService.list(filters);
        
        // Trier par date d'entrée croissante
        const sortedTrades = [...response.results].sort((a, b) => {
          const dateA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
          const dateB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
          return dateA - dateB;
        });
        
        setTrades(sortedTrades);

        // Charger les stratégies de manière asynchrone (non bloquant)
        // pour ne pas ralentir l'affichage initial des données
        (async () => {
          const strategiesMap = new Map<number, TradeStrategy>();
          try {
            // Récupérer toutes les dates uniques des trades
            const uniqueDates = new Set<string>();
            sortedTrades.forEach((trade: TradeListItem) => {
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
  }, [accountId, selectedPeriod, selectedYear, selectedMonth, accountLoading, t]);

  // Charger tous les trades pour le calcul des séquences consécutives (sans filtres date)
  useEffect(() => {
    // Attendre que le compte soit chargé avant de charger les données
    if (accountLoading) {
      return;
    }

    const loadAllTradesForSequences = async () => {
      try {
        const filters: any = {
          trading_account: accountId ?? undefined,
          page_size: 10000, // Limite raisonnable pour toutes les périodes
        };

        const response = await tradesService.list(filters);
        
        // Trier par date d'entrée croissante
        const sortedTrades = [...response.results].sort((a, b) => {
          const dateA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
          const dateB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
          return dateA - dateB;
        });
        
        setAllTradesForSequences(sortedTrades);

        // Charger les stratégies pour tous les trades
        (async () => {
          setStrategiesLoading(true);
          const strategiesMap = new Map<number, TradeStrategy>();
          try {
            // Récupérer toutes les dates uniques des trades
            const uniqueDates = new Set<string>();
            sortedTrades.forEach(trade => {
              if (trade.trade_day) {
                uniqueDates.add(trade.trade_day);
              } else if (trade.entered_at) {
                // Utiliser entered_at si trade_day n'est pas disponible
                const date = new Date(trade.entered_at);
                uniqueDates.add(date.toISOString().split('T')[0]);
              }
            });

            // Limiter l'historique pour les séquences consécutives
            // 12 mois glissant (365 jours) pour avoir un historique complet
            // Les séquences consécutives sont calculées sur les 12 derniers mois
            const allDates = Array.from(uniqueDates).sort().reverse(); // Du plus récent au plus ancien
            const maxDays = 365; // 12 mois glissant
            const datesArray = allDates.slice(0, maxDays);
            
            // Charger les stratégies en parallèle (batch de 10 à la fois)
            const batchSize = 10;
            for (let i = 0; i < datesArray.length; i += batchSize) {
              const batch = datesArray.slice(i, i + batchSize);
              await Promise.all(
                batch.map(async (date) => {
                  try {
                    const dateStrategies = await tradeStrategiesService.byDate(date, accountId ?? undefined);
                    dateStrategies.forEach(strategy => {
                      strategiesMap.set(strategy.trade, strategy);
                    });
                  } catch (e) {
                    // Ignorer les erreurs pour les dates sans stratégies
                    console.debug(`Aucune stratégie pour la date ${date}`);
                  }
                })
              );
            }
          } catch (err) {
            console.error('Erreur lors du chargement des stratégies pour séquences', err);
          } finally {
            setStrategiesLoading(false);
          }

          setAllStrategiesForSequences(strategiesMap);
        })();
      } catch (err) {
        console.error('Erreur lors du chargement des trades pour séquences', err);
      }
    };

    loadAllTradesForSequences();
  }, [accountId, accountLoading]);

  // Calculer le solde du compte dans le temps avec format { date, pnl, cumulative }
  // Utiliser les données agrégées si disponibles (beaucoup plus rapide)
  const accountBalanceData = useMemo(() => {
    // Utiliser les données agrégées si disponibles (beaucoup plus rapide)
    if (dailyAggregates.length > 0) {
      const sortedDates = [...dailyAggregates].sort((a, b) => a.date.localeCompare(b.date));
      let cumulativeBalance = 0;
      
      return sortedDates.map(item => {
        cumulativeBalance += item.pnl;
        return {
          date: item.date,
          pnl: item.pnl,
          cumulative: cumulativeBalance,
        };
      });
    }
    
    // Fallback: utiliser les trades individuels si les agrégats ne sont pas disponibles
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
  }, [dailyAggregates, trades]);

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
  // Utiliser les données agrégées si disponibles
  const waterfallData = useMemo(() => {
    // Utiliser les données agrégées si disponibles (beaucoup plus rapide)
    if (dailyAggregates.length > 0) {
      const sortedDates = [...dailyAggregates].sort((a, b) => a.date.localeCompare(b.date));
      let cumulativeBalance = 0;
      
      return sortedDates.map(item => {
        cumulativeBalance += item.pnl;
        return {
          date: new Date(item.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', timeZone: preferences.timezone }),
          pnl: item.pnl,
          cumulative: cumulativeBalance,
          is_positive: item.pnl >= 0,
        };
      });
    }
    
    // Fallback: utiliser les trades individuels
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
  }, [dailyAggregates, trades, preferences.timezone]);

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
    const leastActiveDay = weekdayPerformanceData.reduce((min, day) => 
      day.trade_count < min.trade_count ? day : min, 
      weekdayPerformanceData[0]
    );
    const totalTrades = weekdayPerformanceData.reduce((sum, day) => sum + day.trade_count, 0);
    const totalPnl = weekdayPerformanceData.reduce((sum, day) => sum + day.total_pnl, 0);

    return {
      bestDay,
      worstDay,
      mostActiveDay,
      leastActiveDay,
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
    // Utiliser les trades complets (sans filtres date) pour les séquences
    // Si allTradesForSequences est vide, utiliser les trades filtrés (fallback)
    const tradesForSequences = allTradesForSequences.length > 0 ? allTradesForSequences : trades;
    // Utiliser allStrategiesForSequences seulement si on a des trades complets ET que les stratégies sont chargées
    const strategiesForSequences = (allTradesForSequences.length > 0 && allStrategiesForSequences.size > 0 && !strategiesLoading) 
      ? allStrategiesForSequences 
      : strategies;
    
    // Vérifier qu'on a au moins des trades pour calculer les statistiques
    if (trades.length === 0 && tradesForSequences.length === 0) return null;

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
    // Utiliser tradesForSequences et strategiesForSequences (sans filtres date si disponibles)
    // pour calculer les séquences globales du compte
    // 1. Séquences de trades consécutifs
    let maxConsecutiveTradesRespected = 0;
    let maxConsecutiveTradesNotRespected = 0;
    let currentConsecutiveTradesRespected = 0;
    let currentConsecutiveTradesNotRespected = 0;

    // 2. Séquences de jours consécutifs
    let maxConsecutiveDaysRespected = 0;
    let maxConsecutiveDaysNotRespected = 0;
    let currentConsecutiveDaysRespected = 0;
    let currentConsecutiveDaysNotRespected = 0;
    
    const sortedTradesForSequences = [...tradesForSequences].sort((a, b) => {
      const dateA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
      const dateB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
      return dateA - dateB;
    });

    // Calculer les séquences de trades consécutifs
    sortedTradesForSequences.forEach(trade => {
      const strategy = strategiesForSequences.get(trade.id);
      const isRespected = strategy?.strategy_respected;

      if (isRespected === true) {
        currentConsecutiveTradesRespected++;
        currentConsecutiveTradesNotRespected = 0;
        maxConsecutiveTradesRespected = Math.max(maxConsecutiveTradesRespected, currentConsecutiveTradesRespected);
      } else if (isRespected === false) {
        currentConsecutiveTradesNotRespected++;
        currentConsecutiveTradesRespected = 0;
        maxConsecutiveTradesNotRespected = Math.max(maxConsecutiveTradesNotRespected, currentConsecutiveTradesNotRespected);
      } else {
        // Si strategy_respected est null ou undefined (pas de stratégie), réinitialiser les compteurs
        // pour ne compter que les séquences de trades avec stratégie définie
        currentConsecutiveTradesRespected = 0;
        currentConsecutiveTradesNotRespected = 0;
      }
    });

    // Calculer les séquences de jours consécutifs
    // Grouper les trades par jour
    const tradesByDay = new Map<string, typeof sortedTradesForSequences>();
    sortedTradesForSequences.forEach(trade => {
      if (trade.trade_day || trade.entered_at) {
        const dateStr = trade.trade_day || trade.entered_at;
        if (dateStr) {
          const date = new Date(dateStr);
          const dayKey = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
          if (!tradesByDay.has(dayKey)) {
            tradesByDay.set(dayKey, []);
          }
          tradesByDay.get(dayKey)!.push(trade);
        }
      }
    });

    // Trier les jours par date (seulement les jours avec trades)
    // La consécutivité est basée sur les jours avec trades, pas sur les jours calendaires
    // Deux jours avec trades sont consécutifs s'il n'y a pas d'autre jour avec trades entre eux
    // Puisque la liste est triée et ne contient que les jours avec trades,
    // chaque jour dans cette liste est automatiquement consécutif au précédent
    const sortedDays = Array.from(tradesByDay.keys()).sort();
    
    // Parcourir les jours avec trades dans l'ordre chronologique
    sortedDays.forEach((dayKey) => {
      const dayTrades = tradesByDay.get(dayKey)!;
      
      // Vérifier si tous les trades du jour ont une stratégie
      const tradesWithStrategy = dayTrades.filter(trade => {
        const strategy = strategiesForSequences.get(trade.id);
        return strategy?.strategy_respected !== null && strategy?.strategy_respected !== undefined;
      });

      // Si aucun trade du jour n'a de stratégie, réinitialiser les compteurs
      if (tradesWithStrategy.length === 0) {
        currentConsecutiveDaysRespected = 0;
        currentConsecutiveDaysNotRespected = 0;
        return;
      }

      // Vérifier si tous les trades du jour respectent la stratégie
      const allRespected = tradesWithStrategy.every(trade => {
        const strategy = strategiesForSequences.get(trade.id);
        return strategy?.strategy_respected === true;
      });

      // Vérifier si tous les trades du jour ne respectent pas la stratégie
      const allNotRespected = tradesWithStrategy.every(trade => {
        const strategy = strategiesForSequences.get(trade.id);
        return strategy?.strategy_respected === false;
      });

      // Si tous les trades du jour respectent la stratégie, incrémenter le compteur de jours consécutifs
      if (allRespected && tradesWithStrategy.length === dayTrades.length) {
        // Tous les trades du jour ont une stratégie et tous respectent
        currentConsecutiveDaysRespected++;
        currentConsecutiveDaysNotRespected = 0;
        maxConsecutiveDaysRespected = Math.max(maxConsecutiveDaysRespected, currentConsecutiveDaysRespected);
      } else if (allNotRespected && tradesWithStrategy.length === dayTrades.length) {
        // Tous les trades du jour ont une stratégie et aucun ne respecte
        currentConsecutiveDaysNotRespected++;
        currentConsecutiveDaysRespected = 0;
        maxConsecutiveDaysNotRespected = Math.max(maxConsecutiveDaysNotRespected, currentConsecutiveDaysNotRespected);
      } else {
        // Mix de respect/non-respect ou certains trades sans stratégie
        currentConsecutiveDaysRespected = 0;
        currentConsecutiveDaysNotRespected = 0;
      }
    });

    // Calculer la série en cours de jours consécutifs avec P/L positif
    // Cette série compte depuis le jour le plus récent jusqu'à trouver une perte
    let currentWinningStreakDays = 0;
    if (sortedDays.length > 0) {
      // Trier les jours par date (du plus récent au plus ancien)
      const sortedDaysReverse = [...sortedDays].sort().reverse();
      
      // Compter les jours consécutifs avec P/L positif depuis le plus récent
      for (const dayKey of sortedDaysReverse) {
        const dayTrades = tradesByDay.get(dayKey)!;
        const dayPnl = dayTrades.reduce((sum, t) => sum + (t.net_pnl ? parseFloat(t.net_pnl) : 0), 0);
        
        if (dayPnl > 0) {
          currentWinningStreakDays++;
        } else {
          // Dès qu'on trouve une perte ou un break-even, on s'arrête
          break;
        }
      }
    }
    
    return {
      totalTrades,
      totalPnl,
      profitFactor,
      totalFees,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      maxConsecutiveTradesRespected,
      maxConsecutiveTradesNotRespected,
      maxConsecutiveDaysRespected,
      maxConsecutiveDaysNotRespected,
      currentConsecutiveTradesRespected,
      currentConsecutiveTradesNotRespected,
      currentConsecutiveDaysRespected,
      currentConsecutiveDaysNotRespected,
      currentWinningStreakDays,
    };
  }, [trades, strategies, allTradesForSequences, allStrategiesForSequences, strategiesLoading]);

  // Préparer les données pour le hook (utiliser allTradesForSequences si disponible)
  const allTradesForIndicators = useMemo(() => {
    return allTradesForSequences.length > 0 ? allTradesForSequences : trades;
  }, [allTradesForSequences, trades]);

  // Utiliser le hook pour calculer les indicateurs de compte de manière cohérente
  const indicators = useAccountIndicators({
    selectedAccount,
    allTrades: allTradesForIndicators,
    filteredTrades: trades,
    filteredBalanceData,
  });


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
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          {/* Compte de trading */}
          <div className="flex-shrink-0 lg:w-80">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard:tradingAccount')}
            </label>
            <AccountSelector value={accountId} onChange={setAccountId} hideLabel />
          </div>
          
          {/* Sélecteur de période moderne */}
          <div className="flex-shrink-0 lg:w-80">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dashboard:period', { defaultValue: 'Période' })}
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

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Section Discipline & Stratégie */}
      {complianceStats && !complianceLoading && (
        <div className="mb-3">
          <MetricGroup
            title={t('strategy:section.title', { defaultValue: 'Discipline & Stratégie' })}
            subtitle={t('strategy:section.subtitle', { defaultValue: 'Suivez votre respect de la stratégie et obtenez des récompenses' })}
            defaultCollapsed={true}
            className="mb-0"
          >
          {/* Streak Card */}
          <div className="mb-6">
            <StrategyStreakCard
              currentStreak={complianceStats.current_streak}
              streakStartDate={complianceStats.current_streak_start}
              nextBadge={complianceStats.next_badge}
            />
          </div>

          {/* Impact du respect de la stratégie et badges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <PerformanceComparison
              performanceComparison={complianceStats.performance_comparison}
              currencySymbol={currencySymbol}
            />
            <StrategyBadges badges={complianceStats.badges} />
          </div>
        </MetricGroup>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mt-3">
          {/* Graphique 1: Métriques de trading (jauges circulaires) */}
          {tradingMetrics && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 h-full flex flex-col">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{t('dashboard:traderPerformanceTracker')}</h2>
                <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t('dashboard:objectivesBasedOnHistory')}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-4 flex-1">
                {/* Jauge Win Rate */}
                <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-3 sm:p-4 shadow-md border border-gray-200 dark:border-gray-600 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-center uppercase tracking-wide">
                    {t('dashboard:winRate')}
                  </h3>
                  <div className="relative w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] mx-auto mb-3 sm:mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90 absolute top-0 left-0" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
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
                      <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
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
                <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-3 sm:p-4 shadow-md border border-gray-200 dark:border-gray-600 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-center uppercase tracking-wide">
                    {t('dashboard:avgWinning')}
                  </h3>
                  <div className="relative w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] mx-auto mb-3 sm:mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90 absolute top-0 left-0" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
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
                      <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 text-center px-2">
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
                <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-3 sm:p-4 shadow-md border border-gray-200 dark:border-gray-600 hover:shadow-2xl hover:scale-105 hover:-translate-y-1 transition-all duration-300 ease-in-out cursor-pointer">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-center uppercase tracking-wide">
                    {t('dashboard:avgLosing')}
                  </h3>
                  <div className="relative w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] mx-auto mb-3 sm:mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90 absolute top-0 left-0" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
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
                      <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 text-center px-2">
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
            <div className="h-full flex flex-col min-h-0">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 flex-1 grid-auto-rows-[1fr] items-stretch">
              <ModernStatCard
                label={t('dashboard:totalPnL')}
                value={
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2 sm:gap-0">
                    <span className="break-words">{formatCurrency(additionalStats.totalPnl, currencySymbol)}</span>
                    <Tooltip content={t('statistics:overview.currentWinningStreakTooltip', { defaultValue: 'Nombre de jours consécutifs avec un P/L positif' })}>
                      <span className="inline-flex items-center gap-1 cursor-help flex-shrink-0">
                        <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {t('statistics:overview.currentWinningStreak', { defaultValue: 'Profit Streak' })}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                          additionalStats.currentWinningStreakDays > 0 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {additionalStats.currentWinningStreakDays || 0} {(additionalStats.currentWinningStreakDays || 0) === 1 ? t('statistics:overview.day', { defaultValue: 'jour' }) : t('statistics:overview.days', { defaultValue: 'jours' })}
                        </span>
                      </span>
                    </Tooltip>
                  </div>
                }
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
                value={formatNumber(additionalStats.profitFactor, 2)}
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
                value={tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 ? formatNumber(Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade), 2) : formatNumber(0, 2)}
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
              
              <Tooltip content={t('dashboard:sequencesPeriodTooltip', { defaultValue: 'Calculé sur les 12 derniers mois glissants' })}>
                <div className="h-full">
                  <ModernStatCard
                    label={additionalStats.currentConsecutiveDaysRespected > 0 
                      ? `${t('dashboard:currentSeries')} - ${t('dashboard:sequenceRespect')}`
                      : additionalStats.currentConsecutiveDaysNotRespected > 0
                      ? `${t('dashboard:currentSeries')} - ${t('dashboard:sequenceNotRespect')}`
                      : t('dashboard:currentSeries')
                    }
                    value={additionalStats.currentConsecutiveDaysRespected > 0 
                      ? `${additionalStats.currentConsecutiveDaysRespected} ${t('dashboard:days')}`
                      : additionalStats.currentConsecutiveDaysNotRespected > 0
                      ? `${additionalStats.currentConsecutiveDaysNotRespected} ${t('dashboard:days')}`
                      : `0 ${t('dashboard:days')}`
                    }
                    variant={additionalStats.currentConsecutiveDaysRespected > 0 ? 'success' : additionalStats.currentConsecutiveDaysNotRespected > 0 ? 'danger' : 'default'}
                    size="small"
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    subMetrics={[
                      {
                        label: additionalStats.currentConsecutiveDaysRespected > 0 ? t('dashboard:currentRespectDays') : t('dashboard:currentNotRespectDays'),
                        value: `${additionalStats.currentConsecutiveDaysRespected > 0 ? additionalStats.currentConsecutiveDaysRespected : additionalStats.currentConsecutiveDaysNotRespected || 0} ${t('dashboard:days')}`
                      },
                      {
                        label: additionalStats.currentConsecutiveTradesRespected > 0 ? t('dashboard:currentRespectTrades') : t('dashboard:currentNotRespectTrades'),
                        value: `${additionalStats.currentConsecutiveTradesRespected > 0 ? additionalStats.currentConsecutiveTradesRespected : additionalStats.currentConsecutiveTradesNotRespected || 0} ${t('trades:trades')}`
                      }
                    ]}
                    trend={additionalStats.currentConsecutiveDaysRespected > 0 ? 'up' : additionalStats.currentConsecutiveDaysNotRespected > 0 ? 'down' : undefined}
                    trendValue={additionalStats.currentConsecutiveDaysRespected > 0 ? t('dashboard:sequenceRespect') : additionalStats.currentConsecutiveDaysNotRespected > 0 ? t('dashboard:sequenceNotRespect') : undefined}
                  />
                </div>
              </Tooltip>
              
              <Tooltip content={t('dashboard:sequencesPeriodTooltip', { defaultValue: 'Calculé sur les 12 derniers mois glissants' })}>
                <div className="h-full">
                  <ModernStatCard
                    label={t('dashboard:sequenceRespect')}
                    value={`${additionalStats.maxConsecutiveDaysRespected || 0} ${t('dashboard:days')}`}
                    variant={additionalStats.maxConsecutiveDaysRespected >= 21 ? 'success' : additionalStats.maxConsecutiveDaysRespected > 0 ? 'info' : 'default'}
                    size="small"
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    progressValue={additionalStats.maxConsecutiveDaysRespected || 0}
                    progressMax={21}
                    progressLabel={t('dashboard:objective')}
                    subMetrics={[
                      {
                        label: t('dashboard:maxTrades'),
                        value: `${additionalStats.maxConsecutiveTradesRespected || 0} ${t('trades:trades')}`
                      },
                      {
                        label: '',
                        value: ''
                      }
                    ]}
                    trend={additionalStats.maxConsecutiveDaysRespected >= 21 ? 'up' : additionalStats.maxConsecutiveDaysRespected > 0 ? 'up' : undefined}
                    trendValue={additionalStats.maxConsecutiveDaysRespected >= 21 ? t('dashboard:objectiveAchieved') : additionalStats.maxConsecutiveDaysRespected > 0 ? `${21 - (additionalStats.maxConsecutiveDaysRespected || 0)} ${t('dashboard:daysRemaining')}` : undefined}
                  />
                </div>
              </Tooltip>
              
              <Tooltip content={t('dashboard:sequencesPeriodTooltip', { defaultValue: 'Calculé sur les 12 derniers mois glissants' })}>
                <div className="h-full">
                  <ModernStatCard
                    label={t('dashboard:sequenceNotRespect')}
                    value={`${additionalStats.maxConsecutiveDaysNotRespected || 0} ${t('dashboard:days')}`}
                    variant={additionalStats.maxConsecutiveDaysNotRespected >= 3 ? 'danger' : additionalStats.maxConsecutiveDaysNotRespected > 0 ? 'warning' : 'default'}
                    size="small"
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    }
                    subMetrics={[
                      {
                        label: t('dashboard:maxTrades'),
                        value: `${additionalStats.maxConsecutiveTradesNotRespected || 0} ${t('trades:trades')}`
                      },
                      {
                        label: '',
                        value: ''
                      }
                    ]}
                    trend={additionalStats.maxConsecutiveDaysNotRespected > 0 ? 'down' : undefined}
                    trendValue={additionalStats.maxConsecutiveDaysNotRespected > 0 ? t('dashboard:needsAttention') : undefined}
                  />
                </div>
              </Tooltip>
              </div>
            </div>
          )}

          {/* Graphique 2: Solde du compte dans le temps */}
          {accountBalanceData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="mb-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-3 gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('dashboard:accountBalanceOverTime')}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {performanceStats.totalReturn >= 0 ? t('dashboard:totalGain') : t('dashboard:totalLoss')} :
                        </span>
                        <span className={`text-lg font-bold ${performanceStats.totalReturn >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}`}>
                          {formatCurrency(performanceStats.totalReturn, currencySymbol)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 text-xs text-gray-500 dark:text-gray-400">
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
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:ml-4 flex-shrink-0">
                    {/* Start Date Picker */}
                    <div className="relative flex-1 sm:flex-initial">
                      <div className="absolute -top-2 left-3 bg-white dark:bg-gray-800 px-1 text-xs font-medium text-gray-600 dark:text-gray-400 z-10">
                        {t('dashboard:startDate')}
                      </div>
                      <DateInput
                        value={startDate || defaultStartDate}
                        onChange={(value) => setStartDate(value || defaultStartDate)}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        min={defaultStartDate}
                        max={defaultEndDate}
                      />
                    </div>
                    
                    {/* Hyphen */}
                    <span className="hidden sm:inline text-gray-500 dark:text-gray-400 text-xl font-medium">-</span>

                    {/* End Date Picker */}
                    <div className="relative flex-1 sm:flex-initial">
                      <div className="absolute -top-2 left-3 bg-white dark:bg-gray-800 px-1 text-xs font-medium text-gray-600 dark:text-gray-400 z-10">
                        {t('dashboard:endDate')}
                      </div>
                      <DateInput
                        value={endDate || defaultEndDate}
                        onChange={(value) => setEndDate(value || defaultEndDate)}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        min={defaultStartDate}
                        max={defaultEndDate}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-80">
                <AccountBalanceChart
                  data={filteredBalanceData}
                  currencySymbol={currencySymbol}
                  formatCurrency={formatCurrency}
                />
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
                      <span className="font-medium text-pink-500">{weekdayStats.leastActiveDay.day} ({weekdayStats.leastActiveDay.trade_count} {t('trades:trades')})</span>
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
                        anchor: 'center' as const,
                        align: 'center' as const,
                        color: function(context: any) {
                          // Dans chartjs-plugin-datalabels, accéder à la valeur via le dataset
                          const dataset = context.dataset;
                          const dataIndex = context.dataIndex;
                          const value = dataset?.data?.[dataIndex] ?? 0;
                          // S'assurer que la valeur est un nombre
                          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                          // Blanc sur fond bleu (positif) ou rose (négatif)
                          return '#ffffff';
                        },
                        font: {
                          weight: 700, // Plus gras pour meilleure lisibilité
                          size: windowWidth < 640 ? 11 : 13,
                        },
                        backgroundColor: function(context: any) {
                          // Ajouter un fond semi-transparent sur mobile pour améliorer la lisibilité
                          if (windowWidth < 640) {
                            return 'rgba(0, 0, 0, 0.4)';
                          }
                          return 'transparent';
                        },
                        padding: windowWidth < 640 ? 4 : 0,
                        borderRadius: windowWidth < 640 ? 4 : 0,
                        formatter: function(value: any, context: any) {
                          // Accéder à la valeur de différentes manières pour être sûr
                          const dataset = context.dataset;
                          const dataIndex = context.dataIndex;
                          const actualValue = dataset?.data?.[dataIndex] ?? value ?? 0;
                          const numValue = typeof actualValue === 'number' ? actualValue : parseFloat(actualValue) || 0;
                          return formatCurrency(numValue, currencySymbol);
                        },
                        clamp: true, // Empêcher les labels de sortir du graphique
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
                        <span className="font-medium text-gray-700">{waterfallStats.positiveDays}/{waterfallData.length} ({formatNumber(waterfallStats.winRate, 1)}%)</span>
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
