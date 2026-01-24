import { useMemo } from 'react';
import { generateChartColors } from '../utils/chartConfig';

interface UseStrategyChartsParams {
  statistics: any;
  isLoading: boolean;
  formatPeriod: (period: string) => string;
  formatNumber: (value: number, digits?: number) => string;
  getEmotionLabel: (emotion: string) => string;
  t: any;
}

export const useStrategyCharts = ({
  statistics,
  isLoading,
  formatPeriod,
  formatNumber,
  getEmotionLabel,
  t,
}: UseStrategyChartsParams) => {
  // Graphique: Respect de la stratégie en %
  const respectChartData = useMemo(() => {
    if (isLoading || !statistics?.statistics?.period_data) return null;
    
    const periodsWithData = statistics.statistics.period_data.filter((d: any) => 
      (d.total_with_strategy && d.total_with_strategy > 0) || (d.total && d.total > 0)
    );
    
    if (periodsWithData.length === 0) return null;
    
    const enrichedData = periodsWithData.map((d: any) => {
      const totalTrades = d.total || 0;
      const totalWithStrategy = d.total_with_strategy || totalTrades;
      const respectPercentage = d.respect_percentage || 0;
      const notRespectPercentage = d.not_respect_percentage || 0;
      
      const respectedCount = d.respected_count !== undefined ? d.respected_count : Math.round((respectPercentage / 100) * totalWithStrategy);
      const notRespectedCount = d.not_respected_count !== undefined ? d.not_respected_count : Math.round((notRespectPercentage / 100) * totalWithStrategy);
      const daysWithoutTrades = Math.max(0, totalWithStrategy - totalTrades);
      
      return {
        ...d,
        totalWithStrategy,
        daysWithoutTrades,
        respectedCount,
        notRespectedCount,
      };
    });
    
    return {
      labels: enrichedData.map((d: any) => formatPeriod(d.period)),
      datasets: [
        {
          label: t('strategies:respected'),
          data: enrichedData.map((d: any) => d.respect_percentage || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: '#3b82f6',
          borderWidth: 0,
          borderRadius: 0,
        },
        {
          label: t('strategies:notRespected'),
          data: enrichedData.map((d: any) => d.not_respect_percentage || 0),
          backgroundColor: 'rgba(236, 72, 153, 0.8)',
          borderColor: '#ec4899',
          borderWidth: 0,
          borderRadius: 0,
        },
      ],
      enrichedData,
    };
  }, [statistics?.statistics?.period_data, formatPeriod, t, isLoading]);

  // Graphique: Taux de réussite selon respect de la stratégie
  const successRateData = useMemo(() => {
    if (isLoading || !statistics?.statistics) return null;
    if (statistics.statistics.total_strategies === 0) return null;
    
    return {
      labels: [t('strategies:successRateByStrategyRespect')],
      datasets: [
        {
          label: t('strategies:ifStrategyRespected'),
          data: [statistics.statistics.success_rate_if_respected || 0],
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: '#3b82f6',
          borderWidth: 0,
          borderRadius: 0,
        },
        {
          label: t('strategies:ifStrategyNotRespected'),
          data: [statistics.statistics.success_rate_if_not_respected || 0],
          backgroundColor: 'rgba(236, 72, 153, 0.8)',
          borderColor: '#ec4899',
          borderWidth: 0,
          borderRadius: 0,
        },
      ],
    };
  }, [statistics?.statistics, t, isLoading]);

  // Graphique: Répartition des sessions gagnantes
  const winningSessionsData = useMemo(() => {
    if (isLoading || !statistics?.statistics?.winning_sessions_distribution) return null;
    
    const dist = statistics.statistics.winning_sessions_distribution;
    const hasData = (dist.tp1_only || 0) + (dist.tp2_plus || 0) + (dist.no_tp || 0) > 0;
    if (!hasData) return null;
    
    return {
      labels: [t('strategies:tp1Only'), t('strategies:tp2Plus'), t('strategies:noTp')],
      datasets: [
        {
          label: t('strategies:numberOfWinningSessions'),
          data: [dist.tp1_only, dist.tp2_plus, dist.no_tp],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(156, 163, 175, 0.8)',
          ],
          borderColor: ['#3b82f6', '#f97316', '#9ca3af'],
          borderWidth: 0,
          borderRadius: 0,
        },
      ],
    };
  }, [statistics?.statistics?.winning_sessions_distribution, t, isLoading]);

  // Graphique: Répartition des émotions
  const emotionsData = useMemo(() => {
    if (isLoading || !statistics?.statistics?.emotions_distribution) return null;
    
    const sortedEmotions = [...statistics.statistics.emotions_distribution]
      .sort((a: any, b: any) => b.count - a.count);
    
    const top5Emotions = sortedEmotions.slice(0, 5);
    const otherEmotions = sortedEmotions.slice(5);
    const othersCount = otherEmotions.reduce((sum: number, e: any) => sum + e.count, 0);
    
    const labels = top5Emotions.map((e: any) => getEmotionLabel(e.emotion));
    const data = top5Emotions.map((e: any) => e.count);
    
    if (othersCount > 0) {
      labels.push(t('strategies:others'));
      data.push(othersCount);
    }
    
    const colors = generateChartColors(labels.length);
    const total = sortedEmotions.reduce((sum: number, e: any) => sum + e.count, 0);
    
    return {
      labels,
      data,
      datasets: [
        {
          label: t('strategies:numberOfOccurrences'),
          data,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: 0,
        },
      ],
      total,
      totalEmotions: sortedEmotions.length,
      topEmotion: top5Emotions.length > 0 ? {
        label: getEmotionLabel(top5Emotions[0].emotion),
        count: top5Emotions[0].count,
        percentage: total > 0 ? (top5Emotions[0].count / total) * 100 : 0,
      } : null,
      colors,
    };
  }, [statistics?.statistics?.emotions_distribution, getEmotionLabel, t, isLoading]);

  return {
    respectChartData,
    successRateData,
    winningSessionsData,
    emotionsData,
  };
};
