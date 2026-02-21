import React, { useState, useEffect, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { useWindowWidth } from '../hooks/useWindowWidth';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { PeriodSelector, PeriodRange } from '../components/common/PeriodSelector';
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
  RadialLinearScale,
  ArcElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { formatDate } from '../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountSummaryCard } from '../components/common/AccountSummaryCard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStatistics } from '../hooks/useStatistics';
import { AnalyticsPageSkeleton } from '../components/ui/AnalyticsPageSkeleton';
import {
  RadarChart,
  EquityCurveChart,
  DrawdownChart,
  MonthlyPerformanceChart,
  TradingVolumeChart,
  TradesDistributionChart,
  HourlyPerformanceBoxPlotChart,
  CorrelationChart,
  HourlyPerformanceBarsChart,
  HeatmapChart,
  GainsVsLossesChart,
  PnlDistributionChart,
  createRadarAlternatingZonesPlugin,
  createRadarGradientPlugin,
} from '../components/analytics';


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
  RadialLinearScale,
  ArcElement,
  ChartDataLabels
);

const AnalyticsPage: React.FC = () => {
  const { preferences } = usePreferences();
  const { theme } = useTheme();
  const { t } = useI18nTranslation();
  const isDark = theme === 'dark';
  
  // Wrapper pour formatNumber avec préférences
  const formatNumber = useCallback((value: number, digits: number = 2): string => {
    return formatNumberUtil(value, digits, preferences.number_format);
  }, [preferences.number_format]);

  // Wrapper pour formatDate avec préférences (mémorisé pour éviter les re-rendus)
  const formatDateMemo = useCallback((date: string): string => {
    return formatDate(date, preferences.date_format, false, preferences.timezone);
  }, [preferences.date_format, preferences.timezone]);

  // Helper function pour obtenir les couleurs des graphiques selon le thème
  const chartColors = useMemo(() => ({
    text: isDark ? '#d1d5db' : '#374151',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    background: isDark ? '#1f2937' : '#ffffff',
    grid: isDark ? '#374151' : '#e5e7eb',
    border: isDark ? '#4b5563' : '#d1d5db',
    tooltipBg: isDark ? '#374151' : '#ffffff',
    tooltipTitle: isDark ? '#d1d5db' : '#4b5563',
    tooltipBody: isDark ? '#f3f4f6' : '#1f2937',
    tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
  }), [isDark]);
  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId, loading: accountLoading } = useTradingAccount();
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
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [allTrades, setAllTrades] = useState<TradeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  // accountId vient maintenant du contexte global
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const windowWidth = useWindowWidth();

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
    accountId,
    startDate: summaryStartDate,
    endDate: summaryEndDate,
    loading: accountLoading,
  });

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
    // Attendre que le compte soit chargé avant de charger les données
    if (accountLoading) {
      return;
    }

    const loadTrades = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const filters: any = {
          trading_account: accountId ?? undefined,
          page_size: 1000, // Récupérer beaucoup de trades pour les analyses
        };

        // Ajouter le filtre de date selon la période sélectionnée
        if (selectedPeriod) {
          filters.start_date = selectedPeriod.start;
          filters.end_date = selectedPeriod.end;
        } else if (selectedYear) {
          // Rétrocompatibilité avec l'ancien système
          const startDate = selectedMonth 
            ? `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`
            : `${selectedYear}-01-01`;
          
          let endDate: string;
          if (selectedMonth) {
            // Calculer le dernier jour du mois sélectionné
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

        const response = await tradesService.list(filters);
        
        // Les filtres sont déjà appliqués côté serveur, pas besoin de filtrer à nouveau
        setTrades(response.results);
      } catch (err) {
        setError(t('analytics:errorLoadingData'));
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrades();
  }, [accountId, selectedPeriod, selectedYear, selectedMonth, accountLoading, t]);

  // Charger tous les trades du compte pour calculer le solde (sans filtre de période)
  useEffect(() => {
    const loadAllTrades = async () => {
      if (!accountId || accountLoading) {
        setAllTrades([]);
        return;
      }
      try {
        const response = await tradesService.list({
          trading_account: accountId,
          page_size: 10000, // Charger tous les trades
        });
        setAllTrades(response.results);
      } catch (err) {
        console.error('Erreur lors du chargement de tous les trades', err);
        setAllTrades([]);
      }
    };
    loadAllTrades();
  }, [accountId, accountLoading]);

  // Utiliser le hook pour calculer les indicateurs de compte de manière cohérente
  const indicators = useAccountIndicators({
    selectedAccount,
    allTrades,
    filteredTrades: trades,
    activeDays: dashboardSummary?.active_days,
  });

  // Récupérer les statistiques pour le graphique radar
  const { data: statisticsData, isLoading: statisticsLoading } = useStatistics(
    accountLoading ? undefined : accountId,
    selectedPeriod ? null : selectedYear,
    selectedPeriod ? null : selectedMonth,
    selectedPeriod?.start || null,
    selectedPeriod?.end || null
  );

  // Performance par tranche de 30 minutes (nuage de points)
  const hourlyPerformanceScatter = useMemo(() => {
    const scatterData: { timeSlot: number; pnl: number }[] = [];
    const timeSlotsWithData = new Set<number>();
    
    trades.forEach(trade => {
      if (trade.entered_at && trade.net_pnl) {
        const date = new Date(trade.entered_at);
        const hour = date.getHours();
        const minutes = date.getMinutes();
        // Calculer la tranche de 30 minutes : 0.0, 0.5, 1.0, 1.5, etc.
        const timeSlot = hour + (minutes >= 30 ? 0.5 : 0);
        const pnl = parseFloat(trade.net_pnl);
        
        scatterData.push({
          timeSlot,
          pnl,
        });
        timeSlotsWithData.add(timeSlot);
      }
    });

    // Retourner les données et les tranches de 30 minutes avec des trades (pour l'axe X)
    return {
      data: scatterData,
      timeSlotsWithData: Array.from(timeSlotsWithData).sort((a, b) => a - b),
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

    // Calculer la régression linéaire et le coefficient de corrélation
    let regressionLine: { x: number; y: number }[] = [];
    let correlationCoefficient = 0;
    let rSquared = 0;

    if (dataPoints.length > 1) {
      // Calculer les moyennes
      const meanX = dataPoints.reduce((sum, d) => sum + d.trades, 0) / dataPoints.length;
      const meanY = dataPoints.reduce((sum, d) => sum + d.pnl, 0) / dataPoints.length;

      // Calculer la pente (b) et l'ordonnée à l'origine (a) de la droite de régression
      let numerator = 0;
      let denominator = 0;
      let sumSquaredX = 0;
      let sumSquaredY = 0;

      dataPoints.forEach(d => {
        const diffX = d.trades - meanX;
        const diffY = d.pnl - meanY;
        numerator += diffX * diffY;
        denominator += diffX * diffX;
        sumSquaredX += diffX * diffX;
        sumSquaredY += diffY * diffY;
      });

      if (denominator !== 0) {
        const slope = numerator / denominator;
        const intercept = meanY - slope * meanX;

        // Créer les points de la ligne de régression
        const xMin = minTrades;
        const xMax = maxTrades;
        regressionLine = [
          { x: xMin, y: slope * xMin + intercept },
          { x: xMax, y: slope * xMax + intercept },
        ];

        // Calculer le coefficient de corrélation (r)
        const sumSquaredDiff = Math.sqrt(sumSquaredX * sumSquaredY);
        if (sumSquaredDiff !== 0) {
          correlationCoefficient = numerator / sumSquaredDiff;
          rSquared = correlationCoefficient * correlationCoefficient;
        }
      }
    }

    return { dataPoints, xTicks, minTrades, maxTrades, regressionLine, correlationCoefficient, rSquared };
  }, [trades]);

  // Drawdown par jour
  // Le graphique affiche l'écart entre le P/L cumulé le plus élevé (pic) et le P/L cumulé actuel au fil du temps
  const drawdownData = useMemo(() => {
    // Groupement par date : tous les trades sont groupés par date d'entrée
    const dailyData: { [date: string]: number } = {};
    
    trades.forEach(trade => {
      // Vérifications plus robustes pour s'assurer que les données sont valides
      if (!trade.trade_day || trade.net_pnl === null || trade.net_pnl === undefined) {
        return;
      }
      
      const date = String(trade.trade_day).trim();
      if (!date) return;
      
      // Conversion sécurisée du P/L
      const pnlStr = String(trade.net_pnl).trim();
      const pnl = parseFloat(pnlStr);
      
      // Vérifier que le parsing a réussi (pas NaN)
      if (isNaN(pnl)) {
        console.warn('Trade avec net_pnl invalide:', trade.net_pnl, trade);
        return;
      }
      
      // Vérifier que la date est valide
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        console.warn('Trade avec trade_day invalide:', trade.trade_day, trade);
        return;
      }
      
      // P/L journalier : somme du net_pnl pour chaque jour
      dailyData[date] = (dailyData[date] || 0) + pnl;
    });

    const sortedDates = Object.keys(dailyData).sort();
    
    // Si pas de données, retourner un tableau vide
    if (sortedDates.length === 0) {
      return [];
    }
    
    // Récupérer le capital initial du compte sélectionné
    const initialCapital = selectedAccount?.initial_capital 
      ? parseFloat(String(selectedAccount.initial_capital)) 
      : 0;
    
    let cumulativePnl = 0; // P/L cumulé : addition progressive du P/L journalier
    let peakCapital = initialCapital; // Pic de capital : commence au capital initial
    
    const allData = sortedDates.map(date => {
      // Addition progressive du P/L journalier
      cumulativePnl += dailyData[date];
      
      // Calculer le capital actuel (capital initial + P/L cumulé)
      const currentCapital = initialCapital + cumulativePnl;
      
      // Mettre à jour le pic si le capital actuel dépasse le pic précédent
      if (currentCapital > peakCapital) {
        peakCapital = currentCapital;
      }
      
      // Drawdown absolu : différence entre le pic de capital et le capital actuel
      // Le drawdown représente la distance depuis le pic (0 = au pic, jamais négatif)
      const drawdownAmount = currentCapital < peakCapital ? peakCapital - currentCapital : 0;
      
      // Calculer le pourcentage de drawdown par rapport au pic de capital
      const drawdownPercent = peakCapital > 0 && drawdownAmount > 0 
        ? (drawdownAmount / peakCapital) * 100 
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
      
      try {
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: preferences.timezone });
        
        return {
          date: formattedDate,
          drawdown: drawdownAmount, // Utiliser le montant absolu pour le graphique
          drawdownAmount: drawdownAmount,
          drawdownPercent: drawdownPercent, // Pourcentage de drawdown
          cumulativePnl,
          currentCapital, // Ajouter le capital actuel pour les tooltips
          rawDate: date, // Garder la date originale pour le tri/affichage
        };
      } catch (error) {
        console.warn('Erreur lors du formatage de la date:', date, error);
        return {
          date: date,
          drawdown: drawdownAmount, // Utiliser le montant absolu pour le graphique
          drawdownAmount: drawdownAmount,
          drawdownPercent: drawdownPercent, // Pourcentage de drawdown
          cumulativePnl,
          currentCapital, // Ajouter le capital actuel pour les tooltips
          rawDate: date,
        };
      }
    }).filter(item => item !== null && !isNaN(item.drawdown) && !isNaN(item.drawdownAmount));
    
    // Mettre à jour la dépendance du useMemo pour inclure selectedAccount
    
    // Retourner tous les points de données pour avoir une référence visuelle complète
    // Cela permet d'afficher :
    // - Les points avec drawdown > 0 (en dessous du peak)
    // - Les points avec drawdown = 0 (au peak ou au-dessus)
    // Cela garantit qu'on a toujours un graphique visible, même si toujours au pic (ligne à 0)
    return allData;
  }, [trades, preferences.timezone, preferences.language, selectedAccount]);

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
    const hoursWithData = new Set<number>();
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const value = heatmap[day][hour];
        if (value !== 0) {
          hoursWithData.add(hour);
        }
        if (value > maxPnl) maxPnl = value;
        if (value < minPnl) minPnl = value;
      }
    }
    const maxAbs = Math.max(Math.abs(maxPnl), Math.abs(minPnl));

    // Trier les heures avec des données
    const sortedHoursWithData = Array.from(hoursWithData).sort((a, b) => a - b);

    // Ajouter une heure avant et une heure après chaque heure avec des données
    const hoursToDisplay = new Set<number>();
    sortedHoursWithData.forEach(hour => {
      hoursToDisplay.add(hour);
      // Ajouter l'heure avant (si >= 0)
      if (hour > 0) {
        hoursToDisplay.add(hour - 1);
      }
      // Ajouter l'heure après (si <= 23)
      if (hour < 23) {
        hoursToDisplay.add(hour + 1);
      }
    });

    // Trier les heures à afficher
    const finalHoursWithData = Array.from(hoursToDisplay).sort((a, b) => a - b);

    return {
      data: heatmap,
      daysOfWeek,
      maxAbs,
      minPnl,
      maxPnl,
      hoursWithData: finalHoursWithData.length > 0 ? finalHoursWithData : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], // Fallback si aucune donnée
    };
  }, [trades, t]);

  // Distribution des gains vs pertes (histogrammes séparés)
  const gainsVsLossesDistribution = useMemo(() => {
    if (trades.length === 0) return null;

    // Séparer les gains et les pertes
    const gains: number[] = [];
    const losses: number[] = [];
    
    trades.forEach(trade => {
      if (trade.net_pnl !== null && trade.net_pnl !== undefined) {
        const pnl = parseFloat(trade.net_pnl);
        if (pnl > 0) {
          gains.push(pnl);
        } else if (pnl < 0) {
          losses.push(Math.abs(pnl)); // Valeur absolue pour les pertes
        }
      }
    });

    if (gains.length === 0 && losses.length === 0) return null;

    // Calculer les bins pour les gains
    const calculateBins = (values: number[], isGains: boolean) => {
      if (values.length === 0) return [];
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      
      // Cas spécial : si toutes les valeurs sont identiques (range = 0)
      if (range === 0) {
        return [{
          range: `${formatNumber(min, 0)}`,
          rangeLabel: `${formatNumber(min, 0)}`,
          count: values.length,
          midpoint: min,
          start: min,
          end: min,
          binWidth: 0,
        }];
      }
      
      const bins = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(values.length))));
      const binWidth = range / bins;

      const histogram: { [bin: number]: number } = {};
      for (let i = 0; i < bins; i++) {
        histogram[i] = 0;
      }

      values.forEach(value => {
        let binIndex = Math.floor((value - min) / binWidth);
        if (binIndex === bins) binIndex = bins - 1;
        histogram[binIndex] = (histogram[binIndex] || 0) + 1;
      });

      return Array.from({ length: bins }, (_, i) => {
        const start = min + i * binWidth;
        const end = min + (i + 1) * binWidth;
        const midpoint = start + binWidth / 2;
        const count = histogram[i] || 0;
        
        return {
          range: `${formatNumber(start, 0)} - ${formatNumber(end, 0)}`,
          rangeLabel: `${formatNumber(start, 0)}-${formatNumber(end, 0)}`,
          count,
          midpoint,
          start,
          end,
          binWidth,
        };
      }).filter(bin => bin.count > 0);
    };

    const gainsBins = calculateBins(gains, true);
    const lossesBins = calculateBins(losses, false);

    // Trouver le max pour normaliser les hauteurs
    const maxCount = Math.max(
      ...gainsBins.map(b => b.count),
      ...lossesBins.map(b => b.count),
      1
    );

    return {
      gains: gainsBins,
      losses: lossesBins,
      maxCount,
      totalGains: gains.length,
      totalLosses: losses.length,
    };
  }, [trades, formatNumber]);

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
        range: `${formatNumber(start, 0)}`,
        rangeLabel: `${formatNumber(start, 0)} - ${formatNumber(end, 0)}`,
        count: histogram[i] || 0,
        midpoint: midpoint,
        isPositive: midpoint >= 0, // Pour déterminer la couleur
        start: start, // Stocker pour les labels
        end: end, // Stocker pour les labels
        binWidth: binWidth, // Stocker pour référence
      };
    }).filter(bin => bin.count > 0); // Filtrer pour ne garder que les bins avec des données
  }, [trades, formatNumber]);

  // Données pour le graphique Equity Curve (Courbe de capital)
  const equityCurveData = useMemo(() => {
    if (!trades.length) return null;
    
    // Si aucun compte sélectionné (tous les comptes), calculer le capital initial à partir des trades
    // Sinon utiliser le capital initial du compte sélectionné
    let initialCapital = 0;
    if (selectedAccount) {
      initialCapital = selectedAccount.initial_capital 
        ? parseFloat(String(selectedAccount.initial_capital)) 
        : 0;
    } else {
      // Pour "tous les comptes", on peut soit utiliser 0, soit calculer la somme des capitaux initiaux
      // Pour simplifier, on utilise 0 comme point de départ et on affiche juste le PnL cumulé
      initialCapital = 0;
    }

    // Grouper les trades par date
    const dailyData: { [date: string]: number } = {};
    
    trades.forEach(trade => {
      if (!trade.trade_day || trade.net_pnl === null || trade.net_pnl === undefined) {
        return;
      }
      
      const date = String(trade.trade_day).trim();
      if (!date) return;
      
      const pnl = parseFloat(String(trade.net_pnl));
      if (isNaN(pnl)) return;
      
      dailyData[date] = (dailyData[date] || 0) + pnl;
    });

    const sortedDates = Object.keys(dailyData).sort();
    
    if (sortedDates.length === 0) return null;

    let cumulativePnl = 0;
    const equityData = sortedDates.map(date => {
      cumulativePnl += dailyData[date];
      const equity = initialCapital + cumulativePnl;
      return {
        date,
        equity,
        pnl: dailyData[date],
      };
    });

    return {
      labels: equityData.map(d => {
        const date = new Date(d.date);
        return formatDateMemo(date.toISOString());
      }),
      datasets: [
        {
          label: t('analytics:equityCurve.equity', { defaultValue: 'Capital' }),
          data: equityData.map(d => d.equity),
          borderColor: isDark ? '#10b981' : '#059669', // Vert pour la croissance
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: t('analytics:equityCurve.initialCapital', { defaultValue: 'Capital Initial' }),
          data: equityData.map(() => initialCapital),
          borderColor: isDark ? 'rgba(156, 163, 175, 0.5)' : 'rgba(107, 114, 128, 0.5)',
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        },
      ],
      rawData: equityData,
      initialCapital,
    } as any;
  }, [trades, selectedAccount, isDark, t, formatDateMemo]);

  // Performance mensuelle/annuelle (calendrier)
  const monthlyPerformanceData = useMemo(() => {
    if (!trades.length) return null;

    const monthlyData: { [key: string]: { pnl: number; count: number } } = {};
    
    trades.forEach(trade => {
      if (trade.trade_day && trade.net_pnl !== null && trade.net_pnl !== undefined) {
        const date = new Date(trade.trade_day);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const pnl = parseFloat(String(trade.net_pnl));
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { pnl: 0, count: 0 };
        }
        monthlyData[monthKey].pnl += pnl;
        monthlyData[monthKey].count += 1;
      }
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    if (sortedMonths.length === 0) return null;

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    return {
      labels: sortedMonths.map(key => {
        const [year, month] = key.split('-');
        return `${monthNames[parseInt(month) - 1]} ${year}`;
      }),
      pnlData: sortedMonths.map(key => monthlyData[key].pnl),
      countData: sortedMonths.map(key => monthlyData[key].count),
      rawData: sortedMonths.map(key => ({ month: key, ...monthlyData[key] })),
    };
  }, [trades]);

  // Volume de trading dans le temps avec agrégation intelligente
  const tradingVolumeData = useMemo(() => {
    if (!trades.length) return null;

    // Collecter les données par jour
    const dailyData: { [date: string]: number } = {};
    
    trades.forEach(trade => {
      if (trade.trade_day) {
        const date = String(trade.trade_day).trim();
        dailyData[date] = (dailyData[date] || 0) + 1;
      }
    });

    const sortedDates = Object.keys(dailyData).sort();
    if (sortedDates.length === 0) return null;

    const firstDate = new Date(sortedDates[0]);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Décider de l'agrégation selon la période
    // - < 90 jours : par jour
    // - 90-365 jours : par semaine
    // - > 365 jours : par mois
    let aggregation: 'day' | 'week' | 'month' = 'day';
    let groupKey: (date: Date) => string;
    let formatLabel: (date: Date) => string;
    
    if (daysDiff > 365) {
      aggregation = 'month';
      groupKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      formatLabel = (date: Date) => {
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      };
    } else if (daysDiff > 90) {
      aggregation = 'week';
      groupKey = (date: Date) => {
        // Obtenir le lundi de la semaine
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour lundi = 1
        const monday = new Date(d);
        monday.setDate(diff);
        // Utiliser l'année et le numéro de semaine simple
        const year = monday.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const weekNum = Math.floor(((monday.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
      };
      formatLabel = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return formatDateMemo(monday.toISOString());
      };
    } else {
      aggregation = 'day';
      groupKey = (date: Date) => date.toISOString().split('T')[0];
      formatLabel = (date: Date) => formatDateMemo(date.toISOString());
    }

    // Agréger les données
    const aggregatedData: { [key: string]: number } = {};
    
    Object.keys(dailyData).forEach(dateStr => {
      const date = new Date(dateStr);
      const key = groupKey(date);
      aggregatedData[key] = (aggregatedData[key] || 0) + dailyData[dateStr];
    });

    // Créer toutes les périodes entre la première et la dernière
    const allPeriods: string[] = [];
    const currentDate = new Date(firstDate);
    
    while (currentDate <= lastDate) {
      const key = groupKey(new Date(currentDate));
      if (!allPeriods.includes(key)) {
        allPeriods.push(key);
      }
      
      if (aggregation === 'day') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (aggregation === 'week') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Trier les périodes
    allPeriods.sort();
    
    // Créer les données finales
    const labels = allPeriods.map(key => {
      // Extraire la date de la clé pour le formatage
      let date: Date;
      if (aggregation === 'month') {
        const [year, month] = key.split('-');
        date = new Date(parseInt(year), parseInt(month) - 1, 1);
      } else if (aggregation === 'week') {
        const [year, weekStr] = key.split('-W');
        const weekNum = parseInt(weekStr);
        date = new Date(parseInt(year), 0, 1);
        // Calculer le lundi de la semaine
        const startOfYear = new Date(parseInt(year), 0, 1);
        const daysToAdd = (weekNum - 1) * 7 - startOfYear.getDay() + 1;
        date.setDate(daysToAdd);
      } else {
        date = new Date(key);
      }
      return formatLabel(date);
    });

    const data = allPeriods.map(key => aggregatedData[key] || 0);
    
    // Calculer la moyenne mobile (7 périodes)
    const movingAverage = data.map((_, index) => {
      const window = 7;
      const start = Math.max(0, index - Math.floor(window / 2));
      const end = Math.min(data.length, start + window);
      const slice = data.slice(start, end);
      return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
    });

    // Calculer les statistiques
    const values = data.filter(v => v > 0);
    const stats = {
      total: data.reduce((a, b) => a + b, 0),
      average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      median: values.length > 0 ? (() => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      })() : 0,
      max: Math.max(...data, 0),
      min: Math.min(...data.filter(v => v > 0), 0) || 0,
    };

    return {
      labels,
      data,
      movingAverage,
      stats,
      aggregation,
      rawData: allPeriods.map((key, index) => ({ 
        period: key, 
        count: data[index],
        label: labels[index]
      })),
    };
  }, [trades, formatDateMemo]);

  // Ratio Risque/Récompense dans le temps
  const riskRewardData = useMemo(() => {
    if (!trades.length) return null;

    const dailyData: { [date: string]: { rrs: number[]; count: number } } = {};
    
    trades.forEach(trade => {
      if (trade.trade_day && trade.actual_risk_reward_ratio) {
        const date = String(trade.trade_day).trim();
        const rr = parseFloat(trade.actual_risk_reward_ratio);
        if (!isNaN(rr) && rr > 0) {
          if (!dailyData[date]) {
            dailyData[date] = { rrs: [], count: 0 };
          }
          dailyData[date].rrs.push(rr);
          dailyData[date].count += 1;
        }
      }
    });

    const sortedDates = Object.keys(dailyData).sort();
    if (sortedDates.length === 0) return null;

    return {
      labels: sortedDates.map(date => {
        const d = new Date(date);
        return formatDateMemo(d.toISOString());
      }),
      data: sortedDates.map(date => {
        const dayData = dailyData[date];
        const avgRR = dayData.rrs.reduce((sum, rr) => sum + rr, 0) / dayData.rrs.length;
        return avgRR;
      }),
      rawData: sortedDates.map(date => {
        const dayData = dailyData[date];
        const avgRR = dayData.rrs.reduce((sum, rr) => sum + rr, 0) / dayData.rrs.length;
        return { date, avgRR, count: dayData.count };
      }),
    };
  }, [trades, formatDateMemo]);

  // Répartition des trades par résultat
  // Utiliser les statistiques pour avoir la même logique que la carte "Trades Break-even"
  const tradesDistributionData = useMemo(() => {
    if (!trades.length || !statisticsData) return null;

    // break_even_trades = trades avec P/L = 0 OU trades gagnants sans TP atteint
    // Pour éviter le double comptage, on doit exclure les trades gagnants sans TP des gagnants
    // Compter les trades avec P/L = 0 (break-even classique)
    const tradesWithZeroPnl = trades.filter(trade => {
      if (trade.net_pnl === null || trade.net_pnl === undefined) return false;
      const pnl = parseFloat(String(trade.net_pnl));
      return Math.abs(pnl) < 0.001; // Tolérance pour les valeurs très proches de 0
    }).length;

    // Trades gagnants sans TP = break_even_trades - trades avec P/L = 0
    const winningTradesWithoutTp = Math.max(0, (statisticsData.break_even_trades || 0) - tradesWithZeroPnl);

    // Gagnants = winning_trades - trades gagnants sans TP (pour éviter le double comptage)
    const winners = Math.max(0, (statisticsData.winning_trades || 0) - winningTradesWithoutTp);
    const losers = statisticsData.losing_trades || 0;
    const neutral = statisticsData.break_even_trades || 0; // Inclut déjà les trades avec P/L = 0 + trades gagnants sans TP

    const total = winners + losers + neutral;
    if (total === 0) return null;

    return {
      labels: [
        t('analytics:charts.tradesDistribution.winners', { defaultValue: 'Gagnants' }),
        t('analytics:charts.tradesDistribution.losers', { defaultValue: 'Perdants' }),
        t('analytics:charts.tradesDistribution.neutral', { defaultValue: 'Break-even' }),
      ],
      data: [winners, losers, neutral],
      percentages: [
        ((winners / total) * 100).toFixed(1),
        ((losers / total) * 100).toFixed(1),
        ((neutral / total) * 100).toFixed(1),
      ],
      total,
    };
  }, [trades, statisticsData, t]);

  // Graphique radar avec les métriques de performance
  const radarChartData = useMemo(() => {
    if (!statisticsData) return null;

    // Fonction de normalisation pour chaque métrique (0-100)
    const normalize = (value: number, min: number, max: number, inverse: boolean = false): number => {
      if (max === min) return 50; // Valeur par défaut si pas de variation
      const normalized = ((value - min) / (max - min)) * 100;
      return inverse ? 100 - normalized : normalized;
    };

    // Définir les plages de normalisation pour chaque métrique
    const metrics = {
      // Profit Factor: 0-5 (1.0 = seuil de rentabilité, 2.0+ = excellent)
      profitFactor: Math.min(100, Math.max(0, normalize(statisticsData.profit_factor, 0, 3, false))),
      
      // Win Rate: 0-100% (50% = seuil, 60%+ = bon)
      winRate: statisticsData.win_rate || 0,
      
      // Recovery Factor (recovery_ratio): 0-10 (1.0 = seuil, 2.0+ = bon)
      recoveryFactor: Math.min(100, Math.max(0, normalize(statisticsData.recovery_ratio || 0, 0, 5, false))),
      
      // Win/Loss Ratio: 0-5 (1.0 = seuil, 2.0+ = excellent)
      winLossRatio: Math.min(100, Math.max(0, normalize(statisticsData.win_loss_ratio || 0, 0, 3, false))),
      
      // Expectancy: normalisé selon la valeur (positif = bon)
      expectancy: Math.min(100, Math.max(0, normalize(statisticsData.expectancy || 0, -100, 500, false))),
      
      // Max Drawdown (inversé: plus bas = mieux, donc on inverse)
      // 0% = parfait (100), 50% = mauvais (0)
      maxDrawdown: Math.min(100, Math.max(0, normalize(statisticsData.max_drawdown_pct || 0, 0, 50, true))),
    };

    // Couleurs pour chaque métrique
    const metricPointColors = [
      '#3b82f6', // Bleu - Profit Factor
      '#10b981', // Vert - Win Rate
      '#f59e0b', // Orange - Recovery Factor
      '#8b5cf6', // Violet - Win/Loss Ratio
      '#ec4899', // Rose - Expectancy
      '#ef4444', // Rouge - Max Drawdown
    ];

    return {
      labels: [
        t('analytics:radar.profitFactor', { defaultValue: 'Profit Factor' }),
        t('analytics:radar.winRate', { defaultValue: 'Win Rate' }),
        t('analytics:radar.recoveryFactor', { defaultValue: 'Recovery Factor' }),
        t('analytics:radar.winLossRatio', { defaultValue: 'Win/Loss Ratio' }),
        t('analytics:radar.expectancy', { defaultValue: 'Expectancy' }),
        t('analytics:radar.maxDrawdown', { defaultValue: 'Max Drawdown' }),
      ],
      datasets: [
        {
          label: t('analytics:radar.performance', { defaultValue: 'Performance' }),
          data: [
            metrics.profitFactor,
            metrics.winRate,
            metrics.recoveryFactor,
            metrics.winLossRatio,
            metrics.expectancy,
            metrics.maxDrawdown,
          ],
          backgroundColor: 'transparent', // Le dégradé sera dessiné par le plugin
          borderColor: isDark ? '#60a5fa' : '#1e40af', // Bleu plus foncé en mode clair pour meilleure visibilité
          borderWidth: 2, // Épaisseur uniforme
          pointBackgroundColor: metricPointColors, // Couleurs spécifiques pour chaque point
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2, // Bordure plus épaisse pour les points
          pointHoverBackgroundColor: metricPointColors, // Garder les mêmes couleurs au survol
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [statisticsData, isDark, t]);

  // Fonction pour obtenir la couleur de la heatmap (améliorée avec support dark mode)
  const getHeatmapColor = (value: number, maxAbs: number): string => {
    if (maxAbs === 0) return isDark ? '#4b5563' : '#f3f4f6'; // Gris adapté au thème pour les valeurs nulles
    
    const normalized = value / maxAbs; // -1 à 1
    
    if (normalized > 0) {
      // Bleu pour les gains avec gradient amélioré
      const intensity = Math.min(Math.abs(normalized), 1);
      if (isDark) {
        // Mode dark : couleurs plus foncées mais visibles
        if (intensity < 0.2) return '#1e3a8a'; // Bleu très foncé
        if (intensity < 0.4) return '#1e40af'; // Bleu foncé
        if (intensity < 0.6) return '#2563eb'; // Bleu moyen-foncé
        if (intensity < 0.8) return '#3b82f6'; // Bleu
        return '#60a5fa'; // Bleu clair
      } else {
        // Mode clair : couleurs claires
      if (intensity < 0.2) return '#dbeafe'; // Bleu très clair
      if (intensity < 0.4) return '#93c5fd'; // Bleu clair
      if (intensity < 0.6) return '#60a5fa'; // Bleu moyen
      if (intensity < 0.8) return '#3b82f6'; // Bleu
      return '#2563eb'; // Bleu foncé
      }
    } else if (normalized < 0) {
      // Rose pour les pertes avec gradient amélioré
      const intensity = Math.min(Math.abs(normalized), 1);
      if (isDark) {
        // Mode dark : couleurs plus foncées mais visibles
        if (intensity < 0.2) return '#831843'; // Rose très foncé
        if (intensity < 0.4) return '#9f1239'; // Rose foncé
        if (intensity < 0.6) return '#be185d'; // Rose moyen-foncé
        if (intensity < 0.8) return '#db2777'; // Rose
        return '#ec4899'; // Rose clair
      } else {
        // Mode clair : couleurs claires
      if (intensity < 0.2) return '#fce7f3'; // Rose très clair
      if (intensity < 0.4) return '#f9a8d4'; // Rose clair
      if (intensity < 0.6) return '#f472b6'; // Rose moyen
      if (intensity < 0.8) return '#ec4899'; // Rose
      return '#db2777'; // Rose foncé
    }
    }
    return isDark ? '#4b5563' : '#f3f4f6'; // Gris adapté au thème pour zéro
  };

  // État pour l'onglet actif avec mémorisation dans localStorage
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('analytics-active-tab') || 'overview';
  });

  // Mémoriser l'onglet actif dans localStorage
  useEffect(() => {
    localStorage.setItem('analytics-active-tab', activeTab);
  }, [activeTab]);

  // Définition des onglets avec icônes SVG
  const tabs = [
    { 
      id: 'overview', 
      label: t('analytics:tabs.overview'), 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      id: 'riskCapital', 
      label: t('analytics:tabs.riskCapital'), 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      id: 'timeAnalysis', 
      label: t('analytics:tabs.timeAnalysis'), 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      id: 'patterns', 
      label: t('analytics:tabs.patterns'), 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      )
    },
  ];

  // Afficher le skeleton pendant le chargement initial pour une expérience uniforme
  if (accountLoading || isLoading || statisticsLoading) {
    return <AnalyticsPageSkeleton />;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Filtres */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            {/* Compte de trading */}
            <div className="flex-shrink-0 max-w-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('analytics:tradingAccount')}
              </label>
              <AccountSelector value={accountId} onChange={setAccountId} hideLabel />
            </div>
            
            {/* Sélecteur de période moderne */}
            <div className="flex-shrink-0 lg:w-80">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('analytics:period', { defaultValue: 'Période' })}
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
      </div>

      {/* Soldes du compte */}
      {selectedAccount && (
        <AccountSummaryCard 
          className="mb-6"
          indicators={indicators} 
          currencySymbol={currencySymbol} 
          loading={isLoading || summaryLoading}
          error={error || summaryError}
        />
      )}

      {/* Onglets de navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Contenu des onglets */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Onglet Vue d'ensemble */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RadarChart
              data={radarChartData}
              statisticsData={statisticsData}
              currencySymbol={currencySymbol}
              createRadarAlternatingZonesPlugin={createRadarAlternatingZonesPlugin}
              createRadarGradientPlugin={createRadarGradientPlugin}
              chartColors={chartColors}
            />
            <EquityCurveChart
              data={equityCurveData}
              riskRewardData={riskRewardData}
              currencySymbol={currencySymbol}
              chartColors={chartColors}
            />
            <MonthlyPerformanceChart
              data={monthlyPerformanceData}
              currencySymbol={currencySymbol}
              chartColors={chartColors}
            />
            <TradesDistributionChart
              data={tradesDistributionData}
              chartColors={chartColors}
            />
          </div>
        </div>
      )}

      {/* Onglet Risque & Capital */}
      {activeTab === 'riskCapital' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DrawdownChart
              data={drawdownData}
              currencySymbol={currencySymbol}
              chartColors={chartColors}
              tradesCount={trades.length}
            />
            {gainsVsLossesDistribution && (
              <GainsVsLossesChart
                data={gainsVsLossesDistribution}
                chartColors={chartColors}
                windowWidth={windowWidth}
              />
            )}
            <PnlDistributionChart
              data={pnlDistribution}
              currencySymbol={currencySymbol}
              chartColors={chartColors}
              windowWidth={windowWidth}
            />
          </div>
        </div>
      )}

      {/* Onglet Analyse Temporelle */}
      {activeTab === 'timeAnalysis' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <HourlyPerformanceBoxPlotChart
              data={hourlyPerformanceScatter}
              currencySymbol={currencySymbol}
              chartColors={chartColors}
            />
            <HourlyPerformanceBarsChart
              data={hourlyPerformanceBars}
              currencySymbol={currencySymbol}
              chartColors={chartColors}
              windowWidth={windowWidth}
            />
            <HeatmapChart
              data={heatmapData}
              currencySymbol={currencySymbol}
              getHeatmapColor={getHeatmapColor}
            />
            <TradingVolumeChart
              data={tradingVolumeData}
              chartColors={chartColors}
            />
          </div>
        </div>
      )}

      {/* Onglet Corrélations & Patterns */}
      {activeTab === 'patterns' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CorrelationChart
              data={correlationData}
              currencySymbol={currencySymbol}
              chartColors={chartColors}
            />
            <HeatmapChart
              data={heatmapData}
              currencySymbol={currencySymbol}
              getHeatmapColor={getHeatmapColor}
            />
          </div>
        </div>
      )}

      <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
};

export default AnalyticsPage;
