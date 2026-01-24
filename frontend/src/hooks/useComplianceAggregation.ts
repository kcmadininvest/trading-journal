import { useMemo } from 'react';

interface ComplianceDataPoint {
  date: string;
  compliance_rate: number;
  respected: number;
  not_respected: number;
  total?: number;
}

interface AggregatedDataPoint {
  key: string;
  date: Date;
  compliance_rate: number;
  total_strategies: number;
  respected: number;
  count: number;
}

interface ComplianceAggregationResult {
  labels: string[];
  data: number[];
  rawData: AggregatedDataPoint[];
  aggregation: 'day' | 'week' | 'month' | 'year';
  formatTooltipDate: (date: Date) => string;
}

interface UseComplianceAggregationParams {
  complianceData: {
    daily_compliance: ComplianceDataPoint[];
  } | null;
  isLoading: boolean;
}

export const useComplianceAggregation = ({
  complianceData,
  isLoading,
}: UseComplianceAggregationParams): ComplianceAggregationResult | null => {
  return useMemo(() => {
    if (isLoading || !complianceData?.daily_compliance || complianceData.daily_compliance.length === 0) {
      return null;
    }

    const sortedData = [...complianceData.daily_compliance]
      .map((d: any) => {
        const totalStrategies = (d.respected || 0) + (d.not_respected || 0);
        const complianceRate = totalStrategies > 0 
          ? ((d.respected || 0) / totalStrategies) * 100 
          : (d.compliance_rate || 0);
        
        return {
          ...d,
          compliance_rate: complianceRate,
          total_strategies: totalStrategies || d.total || 0,
          date: new Date(d.date),
        };
      })
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

    if (sortedData.length === 0) return null;

    const firstDate = sortedData[0].date;
    const lastDate = sortedData[sortedData.length - 1].date;
    const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const dataPoints = sortedData.length;

    let aggregation: 'day' | 'week' | 'month' | 'year' = 'day';
    let groupKey: (date: Date) => string;
    let formatLabel: (date: Date) => string;
    let formatTooltipDate: (date: Date) => string;

    if (dataPoints > 365 || daysDiff > 730) {
      aggregation = 'year';
      groupKey = (date: Date) => `${date.getFullYear()}`;
      formatLabel = (date: Date) => `${date.getFullYear()}`;
      formatTooltipDate = (date: Date) => date.toLocaleDateString('fr-FR', { year: 'numeric' });
    } else if (dataPoints > 120 || daysDiff > 365) {
      aggregation = 'month';
      groupKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      formatLabel = (date: Date) => {
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      };
      formatTooltipDate = (date: Date) => {
        const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      };
    } else if (dataPoints > 60 || daysDiff > 90) {
      aggregation = 'week';
      groupKey = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      };
      formatLabel = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return monday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      };
      formatTooltipDate = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return `Semaine du ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      };
    } else {
      aggregation = 'day';
      groupKey = (date: Date) => date.toISOString().split('T')[0];
      formatLabel = (date: Date) => date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      formatTooltipDate = (date: Date) => date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    const aggregated: { [key: string]: { 
      sum: number; 
      count: number; 
      totalRespected: number; 
      totalStrategies: number;
      dates: Date[];
      rawData: any[];
    } } = {};

    sortedData.forEach((d: any) => {
      const key = groupKey(d.date);
      if (!aggregated[key]) {
        aggregated[key] = {
          sum: 0,
          count: 0,
          totalRespected: 0,
          totalStrategies: 0,
          dates: [],
          rawData: [],
        };
      }
      aggregated[key].sum += d.compliance_rate;
      aggregated[key].count += 1;
      aggregated[key].totalRespected += d.respected || 0;
      aggregated[key].totalStrategies += d.total_strategies || 0;
      aggregated[key].dates.push(d.date);
      aggregated[key].rawData.push(d);
    });

    const aggregatedArray = Object.keys(aggregated)
      .map(key => {
        const group = aggregated[key];
        const avgRate = group.totalStrategies > 0
          ? (group.totalRespected / group.totalStrategies) * 100
          : group.sum / group.count;
        
        const representativeDate = group.dates[0];
        
        return {
          key,
          date: representativeDate,
          compliance_rate: avgRate,
          total_strategies: group.totalStrategies,
          respected: group.totalRespected,
          count: group.count,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const labels = aggregatedArray.map(d => formatLabel(d.date));
    const data = aggregatedArray.map(d => d.compliance_rate);

    return {
      labels,
      data,
      rawData: aggregatedArray,
      aggregation,
      formatTooltipDate,
    };
  }, [complianceData, isLoading]);
};
