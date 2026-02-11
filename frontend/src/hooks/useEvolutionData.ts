import { useMemo } from 'react';

interface UseEvolutionDataParams {
  complianceAggregation: {
    labels: string[];
    data: number[];
    rawData: any[];
    aggregation: string;
    formatTooltipDate: (date: Date) => string;
  } | null;
  t: any;
}

export const useEvolutionData = ({
  complianceAggregation,
  t,
}: UseEvolutionDataParams) => {
  return useMemo(() => {
    if (!complianceAggregation) return null;
    
    const { labels, data, rawData, aggregation, formatTooltipDate } = complianceAggregation;
    
    // Calculer la moyenne cumulative pour chaque point
    const cumulativeAverageData = rawData.map((_, index) => {
      const pointsUpToNow = rawData.slice(0, index + 1);
      const totalStrategies = pointsUpToNow.reduce((sum, d) => sum + (d.total_strategies || 0), 0);
      const totalRespected = pointsUpToNow.reduce((sum, d) => sum + (d.respected || 0), 0);
      
      if (totalStrategies > 0) {
        return (totalRespected / totalStrategies) * 100;
      } else {
        const sum = pointsUpToNow.reduce((sum, d) => sum + (d.compliance_rate || 0), 0);
        return sum / pointsUpToNow.length;
      }
    });

    // Calculer la moyenne globale
    const totalStrategies = rawData.reduce((sum, d) => sum + (d.total_strategies || 0), 0);
    const totalRespected = rawData.reduce((sum, d) => sum + (d.respected || 0), 0);
    const averageRate = totalStrategies > 0
      ? (totalRespected / totalStrategies) * 100
      : rawData.reduce((sum, d) => sum + (d.compliance_rate || 0), 0) / rawData.length;

    // Couleur des barres : bleu si >= moyenne cumulative, fuchsia si en dessous
    const barBgColors = data.map((value: number, i: number) => {
      return value >= cumulativeAverageData[i] ? 'rgba(98, 155, 248, 0.7)' : 'rgba(240, 109, 173, 0.7)';
    });
    const barBorderColors = data.map((value: number, i: number) => {
      return value >= cumulativeAverageData[i] ? '#629bf8' : '#f06dad';
    });

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: t('strategies:compliance.rate'),
          data,
          backgroundColor: barBgColors,
          borderColor: barBorderColors,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.8,
          categoryPercentage: 0.85,
        },
        {
          type: 'line' as const,
          label: t('strategies:averageRate', { defaultValue: 'Moyenne' }),
          data: cumulativeAverageData,
          borderColor: '#f06dad',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#f06dad',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
        },
      ],
      rawData,
      aggregation,
      formatTooltipDate,
      averageRate,
      cumulativeAverageData,
    };
  }, [complianceAggregation, t]);
};
