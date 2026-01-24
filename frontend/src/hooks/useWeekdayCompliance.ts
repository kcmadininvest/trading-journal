import { useMemo } from 'react';
import { ChartData } from 'chart.js';

interface ComplianceDataPoint {
  date: string;
  compliance_rate: number;
  respected: number;
  not_respected: number;
}

interface WeekdayStats {
  day: string;
  dayIndex: number;
  rate: number;
  count: number;
  total: number;
}

export interface WeekdayComplianceChartData extends ChartData<'bar' | 'line', number[], string> {
  dayStats: WeekdayStats[];
  avgRate: number;
}

interface UseWeekdayComplianceParams {
  complianceData: {
    daily_compliance: ComplianceDataPoint[];
  } | null;
  isLoading: boolean;
  t: (key: string, options?: any) => string;
}

export const useWeekdayCompliance = ({
  complianceData,
  isLoading,
  t,
}: UseWeekdayComplianceParams): WeekdayComplianceChartData | null => {
  return useMemo(() => {
    if (isLoading || !complianceData?.daily_compliance || complianceData.daily_compliance.length === 0) {
      return null;
    }

    const processedData = complianceData.daily_compliance.map((d: any) => {
      const totalStrategies = (d.respected || 0) + (d.not_respected || 0);
      const complianceRate = totalStrategies > 0 
        ? ((d.respected || 0) / totalStrategies) * 100 
        : (d.compliance_rate || 0);
      return {
        ...d,
        compliance_rate: complianceRate,
        date: new Date(d.date),
      };
    });

    const weekdayStats: { [key: number]: { total: number; sum: number; count: number } } = {};
    
    processedData.forEach((d: any) => {
      const weekday = d.date.getDay();
      if (!weekdayStats[weekday]) {
        weekdayStats[weekday] = { total: 0, sum: 0, count: 0 };
      }
      weekdayStats[weekday].sum += d.compliance_rate;
      weekdayStats[weekday].count += 1;
      weekdayStats[weekday].total += (d.respected || 0) + (d.not_respected || 0);
    });

    const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
    const weekdayNames = [
      t('dashboard:sunday', { defaultValue: 'Dimanche' }),
      t('dashboard:monday', { defaultValue: 'Lundi' }),
      t('dashboard:tuesday', { defaultValue: 'Mardi' }),
      t('dashboard:wednesday', { defaultValue: 'Mercredi' }),
      t('dashboard:thursday', { defaultValue: 'Jeudi' }),
      t('dashboard:friday', { defaultValue: 'Vendredi' }),
      t('dashboard:saturday', { defaultValue: 'Samedi' }),
    ];

    const dayStats = weekdayOrder
      .map(dayIndex => {
        const stats = weekdayStats[dayIndex];
        if (!stats || stats.count === 0) return null;
        
        const avgRate = stats.sum / stats.count;
        return {
          day: weekdayNames[dayIndex],
          dayIndex,
          rate: avgRate,
          count: stats.count,
          total: stats.total,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    if (dayStats.length === 0) return null;

    const avgRate = dayStats.reduce((sum, d) => sum + d.rate, 0) / dayStats.length;

    const chartConfig: ChartData<'bar' | 'line', number[], string> = {
      labels: dayStats.map(d => d.day),
      datasets: [
        {
          type: 'bar' as const,
          label: t('strategies:compliance.rate'),
          data: dayStats.map(d => d.rate),
          backgroundColor: dayStats.map(d => {
            const isPositive = d.rate >= avgRate;
            return isPositive ? 'rgba(98, 155, 248, 0.8)' : 'rgba(240, 109, 173, 0.8)';
          }),
          borderColor: dayStats.map(d => {
            const isPositive = d.rate >= avgRate;
            return isPositive ? '#629bf8' : '#f06dad';
          }),
          borderWidth: 0,
          borderRadius: 0,
        },
        {
          type: 'line' as const,
          label: t('strategies:average'),
          data: dayStats.map(() => avgRate),
          borderColor: '#9ca3af',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 0,
        },
      ],
    };

    return {
      ...chartConfig,
      dayStats,
      avgRate,
    };
  }, [complianceData, isLoading, t]);
};
