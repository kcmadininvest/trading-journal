import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrency as formatCurrencyUtil } from '../../utils/numberFormat';

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler
);

interface BalanceDataPoint {
  date: string; // Format YYYY-MM-DD
  pnl: number;
  cumulative: number;
  mll?: number; // Maximum Loss Limit (optionnel)
}

interface AccountBalanceChartProps {
  data: BalanceDataPoint[];
  currencySymbol?: string;
  formatCurrency?: (value: number, currencySymbol?: string) => string;
  initialCapital?: number; // Capital initial pour la ligne de référence
}

function AccountBalanceChart({ 
  data, 
  currencySymbol = '',
  formatCurrency: formatCurrencyProp,
  initialCapital = 0
}: AccountBalanceChartProps) {
  const { t } = useI18nTranslation();
  const { theme } = useTheme();
  const { preferences } = usePreferences();
  const isDark = theme === 'dark';

  // Wrapper pour formatCurrency avec préférences du projet
  // Utilise toujours le currencySymbol de la prop pour garantir la cohérence
  // Si formatCurrencyProp est fourni, l'utiliser, sinon utiliser formatCurrencyUtil directement
  const formatCurrency = useMemo(() => {
    if (formatCurrencyProp) {
      // Si formatCurrencyProp est fourni, créer un wrapper qui utilise toujours currencySymbol de la prop
      return (value: number, symbol?: string): string => {
        const symbolToUse = symbol !== undefined && symbol !== '' ? symbol : currencySymbol;
        return formatCurrencyProp(value, symbolToUse);
      };
    }
    // Sinon, utiliser formatCurrencyUtil directement avec les préférences
    return (value: number, symbol?: string): string => {
      const symbolToUse = symbol !== undefined && symbol !== '' ? symbol : currencySymbol;
      return formatCurrencyUtil(value, symbolToUse, preferences.number_format, 2);
    };
  }, [formatCurrencyProp, currencySymbol, preferences.number_format]);

  // Helper function pour obtenir les couleurs selon le thème
  const chartThemeColors = useMemo(() => ({
    text: isDark ? '#d1d5db' : '#374151',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    background: isDark ? '#1f2937' : '#ffffff',
    grid: isDark ? '#374151' : '#e5e7eb',
    border: isDark ? '#4b5563' : '#d1d5db',
    tooltipBg: isDark ? '#374151' : '#ffffff',
    tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
  }), [isDark]);

  // Préparer les données du graphique
  const { chartData, chartLabels, pnlMapping } = useMemo(() => {
    if (data.length === 0) {
      return {
        chartData: {
          labels: [],
          datasets: [],
        },
        chartLabels: [] as string[],
        pnlMapping: [] as number[],
      };
    }

    const dates = data.map(d => 
      new Date(d.date).toLocaleDateString('fr-FR', { 
        month: 'short', 
        day: 'numeric', 
        timeZone: preferences.timezone 
      })
    );
    const balances = data.map(d => d.cumulative);
    const mllValues = data.map(d => d.mll);

    // Créer des labels et balances avec points intermédiaires au capital initial pour la coloration
    // Ces points intermédiaires permettent de colorer correctement les segments qui traversent le capital initial
    const processedLabels: string[] = [];
    const processedBalances: number[] = [];
    const processedMllValues: (number | null)[] = [];
    const processedPnlMapping: number[] = [];
    const isIntermediatePoint: boolean[] = []; // Marquer les points intermédiaires pour les rendre invisibles

    balances.forEach((balance, index) => {
      const prevBalance = index > 0 ? balances[index - 1] : balance;
      const currentMll = mllValues[index];
      
      // Récupérer le dernier point réel ajouté (pas les points intermédiaires)
      // Chercher en arrière le dernier point non-intermédiaire
      let lastRealBalance = balance;
      if (processedBalances.length > 0) {
        for (let i = processedBalances.length - 1; i >= 0; i--) {
          if (!isIntermediatePoint[i]) {
            lastRealBalance = processedBalances[i];
            break;
          }
        }
      } else {
        // Si c'est le premier point, utiliser prevBalance (qui sera égal à balance)
        lastRealBalance = prevBalance;
      }
      
      // Si le segment traverse le capital initial, ajouter un point intermédiaire invisible au capital initial
      // Cela permet de colorer correctement : rose en dessous, bleu au-dessus
      // Utiliser lastRealBalance pour détecter correctement la traversée
      const crossesInitialCapital = 
        (lastRealBalance < initialCapital && balance > initialCapital) || 
        (lastRealBalance > initialCapital && balance < initialCapital);
      
      if (crossesInitialCapital) {
        // Ajouter le point intermédiaire au capital initial (invisible)
        // Utiliser le même label que le point actuel pour qu'il soit au même endroit sur l'axe X
        processedLabels.push(dates[index]);
        processedBalances.push(initialCapital);
        isIntermediatePoint.push(true); // Marquer comme point intermédiaire
        
        // Pour le MLL au point intermédiaire, utiliser la valeur actuelle ou la précédente
        let mllForIntermediate = currentMll;
        if (mllForIntermediate === undefined) {
          for (let i = index - 1; i >= 0; i--) {
            if (mllValues[i] !== undefined) {
              mllForIntermediate = mllValues[i];
              break;
            }
          }
        }
        processedMllValues.push(mllForIntermediate ?? null);
        processedPnlMapping.push(0); // Pas de PnL pour le point intermédiaire
      }
      
      // Ajouter le point réel de la date
      processedLabels.push(dates[index]);
      processedBalances.push(balance);
      isIntermediatePoint.push(false); // Point réel, visible
      
      // Pour le MLL, utiliser la valeur actuelle ou chercher la dernière valeur définie
      let mllForPoint = currentMll;
      if (mllForPoint === undefined) {
        // Chercher la valeur précédente
        for (let i = index - 1; i >= 0; i--) {
          if (mllValues[i] !== undefined) {
            mllForPoint = mllValues[i];
            break;
          }
        }
        // Si toujours pas trouvé, chercher la valeur suivante
        if (mllForPoint === undefined) {
          for (let i = index + 1; i < mllValues.length; i++) {
            if (mllValues[i] !== undefined) {
              mllForPoint = mllValues[i];
              break;
            }
          }
        }
      }
      processedMllValues.push(mllForPoint ?? null);
      processedPnlMapping.push(data[index]?.pnl ?? 0);
    });

    return {
      chartData: {
        labels: processedLabels,
        datasets: [
          // Dataset principal pour la courbe
          {
            label: 'Solde',
            data: processedBalances,
            tension: 0.4, // courbe lissée
            borderWidth: 3,
            segment: {
              borderColor: (ctx: any) => {
                const v0 = ctx.p0.parsed.y;
                const v1 = ctx.p1.parsed.y;
                // Tolérance pour la comparaison avec le capital initial (problèmes de précision)
                const tolerance = 0.01;
                const isV0AtInitial = Math.abs(v0 - initialCapital) < tolerance;
                const isV1AtInitial = Math.abs(v1 - initialCapital) < tolerance;
                
                // Colorer le segment selon la position du point d'arrivée
                // Si le segment traverse le capital initial, colorer selon la partie du segment
                // Si v0 est au capital initial (point intermédiaire), utiliser la couleur de v1
                // Sinon, utiliser la couleur du point d'arrivée
                if (isV0AtInitial) {
                  // On part du capital initial (point intermédiaire), utiliser la couleur du point d'arrivée
                  return v1 >= initialCapital ? '#3b82f6' : '#ec4899';
                } else if (isV1AtInitial) {
                  // On arrive au capital initial (point intermédiaire), utiliser la couleur du point de départ
                  return v0 >= initialCapital ? '#3b82f6' : '#ec4899';
                } else {
                  // Segment normal, colorer selon le point d'arrivée
                  return v1 >= initialCapital ? '#3b82f6' : '#ec4899';
                }
              },
            },
            fill: false,
            pointRadius: (context: any) => {
              // Ne pas afficher les points intermédiaires (invisibles)
              const index = context.dataIndex;
              const dataset = context.dataset;
              const intermediatePoints = dataset._isIntermediatePoint || [];
              if (intermediatePoints[index]) return 0;
              
              // Afficher les points seulement si le volume de données est faible (< 30 points)
              const dataLength = processedBalances.length;
              if (dataLength > 30) return 0;
              // Vérifier que context.parsed existe avant d'accéder à y
              const value = context.parsed?.y;
              return value !== null && value !== undefined ? 4 : 0;
            },
            pointBackgroundColor: (context: any) => {
              const value = context.parsed?.y;
              return value >= initialCapital ? '#3b82f6' : '#ec4899';
            },
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: (context: any) => {
              const value = context.parsed?.y;
              return value >= initialCapital ? '#3b82f6' : '#ec4899';
            },
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3,
            spanGaps: false,
            _pnlMapping: processedPnlMapping, // Stocker le mapping pour les tooltips
            _isIntermediatePoint: isIntermediatePoint, // Stocker pour masquer les points intermédiaires
            order: 0, // Placer devant tout
          },
          // Dataset pour le Maximum Loss Limit (MLL) - uniquement si des valeurs MLL sont présentes
          ...(processedMllValues.some(mll => mll !== null && mll !== undefined) ? [{
            label: 'Maximum Loss Limit (MLL)',
            data: processedMllValues.map((mll, index) => {
              // Si le MLL n'est pas défini pour ce point, utiliser la dernière valeur définie
              if (mll !== null && mll !== undefined) return mll;
              // Chercher la dernière valeur définie avant ce point
              for (let i = index - 1; i >= 0; i--) {
                if (processedMllValues[i] !== null && processedMllValues[i] !== undefined) {
                  return processedMllValues[i];
                }
              }
              return null;
            }),
            borderColor: '#ef4444', // Rouge pour le MLL
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5], // Ligne en pointillés
            fill: false,
            pointRadius: 0,
            tension: 0.4, // Même courbe arrondie que le solde
            spanGaps: true, // Continuer la ligne même avec des valeurs null
            order: 1, // Placer derrière le solde
            // Utiliser cubicInterpolationMode pour une courbe plus naturelle qui ne "baisse" pas avant de monter
            cubicInterpolationMode: 'monotone' as const,
          }] : []),
        ],
      },
      chartLabels: processedLabels,
      pnlMapping: processedPnlMapping,
    };
  }, [data, preferences.timezone, initialCapital]);

  // Créer un mapping des dates vers les valeurs MLL réelles
  const mllByDate = useMemo(() => {
    const mapping: { [date: string]: number } = {};
    data.forEach(d => {
      if (d.mll !== undefined && d.mll !== null) {
        mapping[d.date] = d.mll;
      }
    });
    return mapping;
  }, [data]);

  // Options du graphique
  const options = useMemo(() => {
    // Trouver l'index du dataset principal (Solde)
    const mainDatasetIndex = chartData.datasets.findIndex((ds: any) => ds.label === 'Solde');
    
    return {
      responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        backgroundColor: chartThemeColors.tooltipBg,
        titleColor: chartThemeColors.text,
        bodyColor: chartThemeColors.text,
        borderColor: chartThemeColors.tooltipBorder,
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
        displayColors: true,
        mode: 'index' as const,
        intersect: false,
        external: function(context: any) {
          // Empêcher complètement l'affichage du tooltip pour les points intermédiaires
          if (!context || !context.tooltip || !context.tooltip.dataPoints || context.tooltip.dataPoints.length === 0) {
            return;
          }
          
          const firstDataPoint = context.tooltip.dataPoints[0];
          const index = firstDataPoint.dataIndex;
          const mainDataset = chartData.datasets[mainDatasetIndex];
          const intermediatePoints = mainDataset?._isIntermediatePoint || [];
          
          // Si c'est un point intermédiaire, empêcher l'affichage du tooltip
          if (intermediatePoints[index]) {
            context.tooltip.opacity = 0;
            context.tooltip.display = false;
          }
        },
        filter: function(tooltipItem: any) {
          const index = tooltipItem.dataIndex;
          const dataset = tooltipItem.dataset;
          const datasetLabel = dataset?.label || '';
          
          // Vérifier d'abord si c'est un point intermédiaire (priorité absolue)
          // Les indices sont alignés entre tous les datasets
          const mainDataset = chartData.datasets[mainDatasetIndex];
          const intermediatePoints = mainDataset?._isIntermediatePoint || [];
          if (intermediatePoints[index]) {
            return false; // Masquer le tooltip pour TOUS les points intermédiaires (Solde et MLL)
          }
          
          // Afficher le tooltip pour le dataset principal (Solde) et le MLL (seulement si ce n'est pas un point intermédiaire)
          return tooltipItem.datasetIndex === mainDatasetIndex || datasetLabel === 'Maximum Loss Limit (MLL)';
        },
        callbacks: {
          title: function(context: any) {
            // Ne pas afficher le titre si tous les éléments sont des points intermédiaires
            if (!context || context.length === 0) {
              return '';
            }
            
            const index = context[0]?.dataIndex ?? 0;
            const mainDataset = chartData.datasets[mainDatasetIndex];
            const intermediatePoints = mainDataset?._isIntermediatePoint || [];
            
            // Si c'est un point intermédiaire, ne pas afficher le titre
            if (intermediatePoints[index]) {
              return ''; // Pas de titre pour les points intermédiaires
            }
            
            return chartLabels[index] || '';
          },
          label: function(context: any) {
            const index = context.dataIndex;
            const datasetLabel = context.dataset.label || '';
            const value = context.parsed.y || 0;
            
            // Si c'est le dataset MLL
            if (datasetLabel === 'Maximum Loss Limit (MLL)') {
              // Utiliser la valeur réelle depuis les données pour cette date
              const dateLabel = chartLabels[index];
              // Trouver la date correspondante dans les données originales
              const correspondingDataPoint = data.find(d => {
                const dataDate = new Date(d.date).toLocaleDateString('fr-FR', { 
                  month: 'short', 
                  day: 'numeric', 
                  timeZone: preferences.timezone 
                });
                return dataDate === dateLabel;
              });
              const realValue = correspondingDataPoint?.mll ?? (context.raw !== null && context.raw !== undefined ? context.raw : value);
              return `${t('dashboard:maximumLossLimit', { defaultValue: 'MLL' })}: ${formatCurrency(realValue, currencySymbol)}`;
            }
            
            // Sinon, c'est le dataset principal (Solde)
            // Ne pas afficher le MLL ici car il est déjà affiché par le dataset MLL
            const pnl = pnlMapping[index] ?? 0;
            const labels = [
              `${t('dashboard:balance')}: ${formatCurrency(value, currencySymbol)}`,
              `${t('dashboard:dayPnLShort')}: ${formatCurrency(pnl, currencySymbol)}`,
            ];
            
            return labels;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: chartThemeColors.textSecondary,
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
        border: {
          color: chartThemeColors.border,
        },
      },
      y: {
        beginAtZero: false,
        ticks: {
          color: chartThemeColors.textSecondary,
          font: {
            size: 12,
          },
          callback: function(value: any) {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value));
            return formatCurrency(numValue, currencySymbol);
          },
        },
        grid: {
          color: chartThemeColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartThemeColors.border,
          display: false,
        },
        title: {
          display: false,
        },
        // Adapter automatiquement l'échelle aux données avec un padding
        afterDataLimits: (scale: any) => {
          const min = scale.min;
          const max = scale.max;
          const range = max - min;
          // Ajouter 10% de padding en haut et en bas pour une meilleure lisibilité
          const padding = range * 0.1;
          scale.min = min - padding;
          scale.max = max + padding;
        },
      },
    },
      animation: {
        duration: 1000,
        easing: 'easeInOutQuart' as const,
      },
    };
  }, [chartData, chartLabels, pnlMapping, chartThemeColors, formatCurrency, currencySymbol, t, data, preferences.timezone]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        {t('dashboard:noDataInPeriod')}
      </div>
    );
  }

  return <Line data={chartData} options={options} />;
}

export default AccountBalanceChart;

