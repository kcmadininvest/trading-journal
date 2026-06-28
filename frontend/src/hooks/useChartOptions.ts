import { useMemo, useRef, type MutableRefObject } from 'react';
import type { ActiveElement, Chart, ChartEvent, EasingFunction } from 'chart.js';
import { WeekdayComplianceChartData } from './useWeekdayCompliance';
import { buildChartTooltipPlugin, type ChartColors } from '../utils/chartConfig';
import type { StrategyChartDrillDownPayload } from '../utils/strategyDrillDown';

function resolveRespectPeriodBounds(dateStr: string): {
  trade_day?: string;
  start_date?: string;
  end_date?: string;
} {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { trade_day: dateStr };
  }
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start_date: `${dateStr}-01`,
      end_date: `${dateStr}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return {};
}

function resolveEvolutionPeriodBounds(
  aggregation: string,
  dayData: { date?: Date; key?: string }
): { start_date: string; end_date: string } | null {
  if (aggregation === 'day') {
    return null;
  }
  const dateObj = dayData.date;
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    if (typeof dayData.key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayData.key)) {
      return { start_date: dayData.key, end_date: dayData.key };
    }
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (aggregation === 'year') {
    const year = dateObj.getFullYear();
    return { start_date: `${year}-01-01`, end_date: `${year}-12-31` };
  }
  if (aggregation === 'month') {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start_date: `${year}-${pad(month + 1)}-01`,
      end_date: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
    };
  }
  if (aggregation === 'week') {
    const monday = new Date(dateObj);
    const sunday = new Date(dateObj);
    sunday.setDate(monday.getDate() + 6);
    return { start_date: iso(monday), end_date: iso(sunday) };
  }
  return null;
}

interface UseChartOptionsParams {
  chartColors: ChartColors;
  windowSize: { isMobile: boolean; isTablet: boolean };
  isDark: boolean;
  optimizedAnimation: { duration: number; easing: EasingFunction };
  formatNumber: (value: number, digits?: number) => string;
  formatStrategyChartPeriod: (row: { period: string; date?: string }) => string;
  t: any;
  i18nLanguage: string;
  // Volatile data passed via refs to avoid invalidating useMemo
  statistics: any;
  respectChartData: any;
  emotionsData: any;
  evolutionData: any;
  weekdayComplianceData: WeekdayComplianceChartData | null;
  onChartDrillDownRef?: MutableRefObject<
    ((payload: StrategyChartDrillDownPayload) => void) | null
  >;
}

export const useChartOptions = ({
  chartColors,
  windowSize,
  isDark,
  optimizedAnimation,
  formatNumber,
  formatStrategyChartPeriod,
  t,
  i18nLanguage,
  statistics,
  respectChartData,
  emotionsData,
  evolutionData,
  weekdayComplianceData,
  onChartDrillDownRef,
}: UseChartOptionsParams) => {
  // Store volatile data in refs so tooltip callbacks always read the latest value
  // without being listed as useMemo dependencies (which would invalidate the memo)
  const statisticsRef = useRef(statistics);
  statisticsRef.current = statistics;

  const respectChartDataRef = useRef(respectChartData);
  respectChartDataRef.current = respectChartData;

  const emotionsDataRef = useRef(emotionsData);
  emotionsDataRef.current = emotionsData;

  const evolutionDataRef = useRef(evolutionData);
  evolutionDataRef.current = evolutionData;

  const weekdayComplianceDataRef = useRef(weekdayComplianceData);
  weekdayComplianceDataRef.current = weekdayComplianceData;

  const onChartDrillDownRefLocal = useRef(onChartDrillDownRef);
  onChartDrillDownRefLocal.current = onChartDrillDownRef;

  const formatNumberRef = useRef(formatNumber);
  formatNumberRef.current = formatNumber;

  const formatStrategyChartPeriodRef = useRef(formatStrategyChartPeriod);
  formatStrategyChartPeriodRef.current = formatStrategyChartPeriod;

  const tRef = useRef(t);
  tRef.current = t;

  const i18nLanguageRef = useRef(i18nLanguage);
  i18nLanguageRef.current = i18nLanguage;

  // Respect chart options
  const respectChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: optimizedAnimation,
    onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
      if (!elements.length) return;
      const element = elements[0];
      const handler = onChartDrillDownRefLocal.current?.current;
      const enrichedRow = (respectChartDataRef.current as { enrichedData?: { date?: string }[] })
        ?.enrichedData?.[element.index];
      if (!handler || !enrichedRow?.date) return;
      const respected = element.datasetIndex === 0;
      handler({
        type: 'respect',
        respected,
        ...resolveRespectPeriodBounds(enrichedRow.date),
      });
    },
    onHover: (event: ChartEvent, elements: ActiveElement[]) => {
      const canvas = event.native?.target as HTMLElement | undefined;
      if (canvas) {
        canvas.style.cursor = elements.length ? 'pointer' : 'default';
      }
    },
    plugins: {
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          weight: 600,
          size: windowSize.isMobile ? 10 : 13,
        },
        formatter: function(value: number) {
          return value > 0 ? formatNumberRef.current(value, 2) + '%' : '';
        },
        anchor: 'center' as const,
        align: 'center' as const,
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: windowSize.isMobile ? 12 : 20,
          font: {
            size: windowSize.isMobile ? 10 : 12
          },
          color: chartColors.textSecondary,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
        callbacks: {
          title: function(context: any) {
            const idx = context[0].dataIndex;
            // Le graphique discipline n'affiche qu'un sous-ensemble de period_data (périodes avec données) :
            // l'index Chart.js correspond à enrichedData, pas à statistics.period_data.
            const enrichedRow = (respectChartDataRef.current as any)?.enrichedData?.[idx];
            if (enrichedRow) {
              return formatStrategyChartPeriodRef.current({
                period: enrichedRow.period,
                date: enrichedRow.date,
              });
            }
            const row = statisticsRef.current?.statistics?.period_data?.[idx];
            return formatStrategyChartPeriodRef.current(
              row ? { period: row.period, date: row.date } : { period: context[0].label || '' }
            );
          },
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            const enrichedData = (respectChartDataRef.current as any)?.enrichedData;
            const periodData = enrichedData?.[context.dataIndex];
            const fn = formatNumberRef.current;
            const tr = tRef.current;
            
            if (!periodData) {
              const fallbackData = statisticsRef.current?.statistics?.period_data?.[context.dataIndex];
              const totalTrades = fallbackData?.total || 0;
              const count = Math.round((value / 100) * totalTrades);
              return `${label}: ${fn(value, 2)}% (${fn(count, 0)} ${tr('strategies:trades')} ${tr('strategies:on', { defaultValue: 'sur' })} ${fn(totalTrades, 0)})`;
            }
            
            const isRespected = label === tr('strategies:respected');
            const count = isRespected ? periodData.respectedCount : periodData.notRespectedCount;
            const totalTrades = periodData.total || 0;
            const totalWithStrategy = periodData.totalWithStrategy || totalTrades;
            const daysWithoutTrades = periodData.daysWithoutTrades || 0;
            
            let elementTrades = 0;
            let elementDays = 0;
            
            if (count <= totalTrades) {
              elementTrades = count;
              elementDays = 0;
            } else {
              elementDays = Math.min(count - totalTrades, daysWithoutTrades);
              elementTrades = count - elementDays;
            }
            
            if (elementDays > 0) {
              return `${label}: ${fn(value, 2)}% (${fn(elementTrades, 0)} ${tr('strategies:trades')} + ${fn(elementDays, 0)} ${elementDays === 1 ? 'jour sans trade' : 'jours sans trades'} ${tr('strategies:on', { defaultValue: 'sur' })} ${fn(totalWithStrategy, 0)})`;
            } else {
              return `${label}: ${fn(value, 2)}% (${fn(elementTrades, 0)} ${tr('strategies:trades')} ${tr('strategies:on', { defaultValue: 'sur' })} ${fn(totalWithStrategy, 0)})`;
            }
          },
        },
        }),
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return `${formatNumberRef.current(Number(value), 0)}%`;
          },
          color: chartColors.textSecondary,
          font: {
            size: windowSize.isMobile ? 10 : 12,
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
      x: {
        stacked: true,
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: windowSize.isMobile ? 10 : 12,
          },
        },
        grid: {
          display: false,
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: false,
        },
      },
    },
  }), [optimizedAnimation, windowSize.isMobile, chartColors]);

  // Success rate chart options
  const successRateOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: optimizedAnimation,
    onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
      if (!elements.length) return;
      const handler = onChartDrillDownRefLocal.current?.current;
      if (!handler) return;
      handler({
        type: 'respect',
        respected: elements[0].datasetIndex === 0,
      });
    },
    onHover: (event: ChartEvent, elements: ActiveElement[]) => {
      const canvas = event.native?.target as HTMLElement | undefined;
      if (canvas) {
        canvas.style.cursor = elements.length ? 'pointer' : 'default';
      }
    },
    plugins: {
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          weight: 600,
          size: windowSize.isMobile ? 10 : 13,
        },
        formatter: function(value: number) {
          return value > 0 ? `${formatNumberRef.current(value, 2)}%` : '';
        },
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: windowSize.isMobile ? 12 : 20,
          font: {
            size: windowSize.isMobile ? 10 : 12
          },
          color: chartColors.textSecondary,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${formatNumberRef.current(value, 2)}%`;
          },
        },
        }),
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return `${formatNumberRef.current(Number(value), 0)}%`;
          },
          color: chartColors.textSecondary,
          font: {
            size: windowSize.isMobile ? 10 : 12,
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
      x: {
        title: {
          display: false,
        },
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: windowSize.isMobile ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
      },
    },
  }), [chartColors, windowSize.isMobile, optimizedAnimation]);

  // Winning sessions chart options
  const winningSessionsOptions = useMemo(() => {
    const dist = statisticsRef.current?.statistics?.winning_sessions_distribution;
    let winningSessionsMax: number | undefined;
    if (dist) {
      const values = [dist.tp1_only, dist.tp2_plus, dist.no_tp];
      const maxValue = Math.max(...values);
      winningSessionsMax = Math.ceil(maxValue * 1.15);
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: optimizedAnimation,
      onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
        if (!elements.length) return;
        const handler = onChartDrillDownRefLocal.current?.current;
        if (!handler) return;
        const buckets: Array<'tp1' | 'tp2_plus' | 'no_tp'> = ['tp1', 'tp2_plus', 'no_tp'];
        const bucket = buckets[elements[0].index];
        if (!bucket) return;
        handler({ type: 'winning_session', bucket });
      },
      onHover: (event: ChartEvent, elements: ActiveElement[]) => {
        const canvas = event.native?.target as HTMLElement | undefined;
        if (canvas) {
          canvas.style.cursor = elements.length ? 'pointer' : 'default';
        }
      },
      plugins: {
        datalabels: {
          display: true,
          color: '#ffffff',
          font: {
            weight: 600,
            size: windowSize.isMobile ? 10 : 13,
          },
          formatter: function(value: number) {
            return value > 0 ? formatNumberRef.current(value, 0) : '';
          },
          anchor: 'center' as const,
          align: 'center' as const,
        },
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: chartColors.text,
            usePointStyle: true,
            padding: 16,
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
          callbacks: {
            title: function(context: any) {
              return context[0].label || '';
            },
            label: function(context: any) {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              const total = statisticsRef.current?.statistics?.winning_sessions_distribution?.total_winning || 1;
              const percentage = total > 0 ? (value / total) * 100 : 0;
              return `${label}: ${formatNumberRef.current(value, 0)} (${formatNumberRef.current(percentage, 1)}%)`;
            },
          },
          }),
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          stacked: false,
          max: winningSessionsMax,
          ticks: {
            stepSize: 1,
            color: chartColors.textSecondary,
            font: {
              size: 12,
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
            display: true,
            text: tRef.current('strategies:numberOfWinningSessions'),
            color: chartColors.text,
            font: {
              size: windowSize.isMobile ? 11 : 13,
              weight: 600,
            },
          },
        },
        x: {
          stacked: false,
          ticks: {
            color: chartColors.textSecondary,
            font: {
              size: windowSize.isMobile ? 10 : 12,
            },
          },
          grid: {
            display: false,
          },
          border: {
            color: chartColors.border,
          },
          title: {
            display: false,
          },
        },
      },
    };
  }, [chartColors, windowSize.isMobile, optimizedAnimation]);

  // Emotions doughnut chart options
  const emotionsOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: optimizedAnimation,
    onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
      if (!elements.length) return;
      const handler = onChartDrillDownRefLocal.current?.current;
      const emotionKeys = (emotionsDataRef.current as { emotionKeys?: string[] })?.emotionKeys;
      const emotion = emotionKeys?.[elements[0].index];
      if (!handler || !emotion) return;
      handler({ type: 'emotion', emotion });
    },
    onHover: (event: ChartEvent, elements: ActiveElement[]) => {
      const canvas = event.native?.target as HTMLElement | undefined;
      if (!canvas) return;
      const emotionKeys = (emotionsDataRef.current as { emotionKeys?: string[] })?.emotionKeys;
      const emotion = elements[0] ? emotionKeys?.[elements[0].index] : undefined;
      canvas.style.cursor = elements.length && emotion ? 'pointer' : 'default';
    },
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
      },
    },
    plugins: {
      datalabels: {
        display: function(context: any) {
          const value = context.dataset.data[context.dataIndex];
          const total = emotionsDataRef.current?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          return percentage >= 4;
        },
        color: function(context: any) {
          const value = context.dataset.data[context.dataIndex];
          const total = emotionsDataRef.current?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          
          if (percentage < 10) {
            return isDark ? '#ffffff' : '#1f2937';
          }
          return isDark ? '#ffffff' : '#374151';
        },
        font: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          weight: 600,
          size: windowSize.isMobile ? 10 : windowSize.isTablet ? 11 : 12,
        },
        formatter: function(value: number, context: any) {
          const label = context.chart.data.labels[context.dataIndex] || '';
          const total = emotionsDataRef.current?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          const fn = formatNumberRef.current;
          
          if (windowSize.isMobile) {
            return `${fn(percentage, 1)}%`;
          }
          
          if (percentage < 10) {
            return `${fn(percentage, 1)}%`;
          }
          
          if (percentage < 20) {
            return `${label} ${fn(percentage, 1)}%`;
          }
          
          return `${label}\n${fn(percentage, 1)}%`;
        },
        anchor: function(context: any) {
          const value = context.dataset.data[context.dataIndex];
          const total = emotionsDataRef.current?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          
          if (percentage < 10) {
            return 'center';
          }
          return 'center';
        },
        align: function() {
          return 'center';
        },
        offset: 0,
        clamp: false,
        clip: false,
        textShadow: false,
      },
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = emotionsDataRef.current?.total || 1;
            const percentage = total > 0 ? (value / total) * 100 : 0;
            return `${label}: ${formatNumberRef.current(value, 0)} (${formatNumberRef.current(percentage, 1)}%)`;
          },
        },
        }),
      },
    },
  }), [chartColors, isDark, windowSize.isMobile, windowSize.isTablet, optimizedAnimation]);

  // Evolution bar+line mixed chart options
  const evolutionOptions = useMemo(() => {
    // Bar chart : toujours 0-100% pour que les barres soient proportionnelles
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: optimizedAnimation,
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      onClick: (_event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
        if (!elements.length) return;
        const element = elements[0];
        const datasetType = (chart.data.datasets[element.datasetIndex] as { type?: string }).type;
        if (datasetType === 'line') return;
        const aggregation = evolutionDataRef.current?.aggregation;
        const dayData = evolutionDataRef.current?.rawData?.[element.index];
        const handler = onChartDrillDownRefLocal.current?.current;
        if (!handler || !dayData) return;
        if (aggregation === 'day') {
          const dateObj = dayData.date as Date | undefined;
          let iso: string | null = null;
          if (dateObj instanceof Date && !Number.isNaN(dateObj.getTime())) {
            iso = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
          } else if (typeof dayData.key === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dayData.key)) {
            iso = dayData.key.slice(0, 10);
          }
          if (iso) {
            handler({ type: 'compliance_day', date: iso });
          }
          return;
        }
        const range = resolveEvolutionPeriodBounds(aggregation ?? 'day', dayData);
        if (range) {
          handler({ type: 'period_range', ...range });
        }
      },
      onHover: (event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
        const canvas = event.native?.target as HTMLElement | undefined;
        if (!canvas) return;
        const element = elements[0];
        const datasetType = element
          ? (chart.data.datasets[element.datasetIndex] as { type?: string }).type
          : undefined;
        canvas.style.cursor = element && datasetType !== 'line' ? 'pointer' : 'default';
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: windowSize.isMobile ? 12 : 20,
            font: {
              size: windowSize.isMobile ? 10 : 12
            },
            color: chartColors.textSecondary,
          },
        },
        datalabels: {
          display: function(context: any) {
            // Ne pas afficher les labels sur les lignes
            if (context.dataset.type === 'line') {
              return false;
            }
            // Masquer les labels si trop de points de données (barres trop étroites)
            const dataLength = context.chart.data.labels?.length || 0;
            if (dataLength > 15) {
              return false;
            }
            return true;
          },
          color: function(context: any) {
            const value = context.dataset.data[context.dataIndex];
            return value <= 5 ? (isDark ? '#d1d5db' : '#6b7280') : '#ffffff';
          },
          font: {
            weight: 600,
            size: windowSize.isMobile ? 9 : 11,
          },
          formatter: function(value: number) {
            return formatNumberRef.current(value, 0) + '%';
          },
          anchor: function(context: any) {
            const value = context.dataset.data[context.dataIndex];
            return value <= 5 ? 'end' : 'end';
          } as any,
          align: function(context: any) {
            const value = context.dataset.data[context.dataIndex];
            return value <= 5 ? 'end' : 'start';
          } as any,
          clamp: true,
        },
        title: {
          display: false,
        },
        tooltip: {
          ...buildChartTooltipPlugin(chartColors, 'lineMultiSeries', undefined, {
          callbacks: {
            title: function(context: any) {
              const rawData = evolutionDataRef.current?.rawData;
              const fmtTooltipDate = evolutionDataRef.current?.formatTooltipDate;
              if (rawData && rawData[context[0].dataIndex]) {
                const dayData = rawData[context[0].dataIndex];
                if (fmtTooltipDate) {
                  return fmtTooltipDate(dayData.date);
                }
                return dayData.date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              }
              return context[0].label || '';
            },
            label: function(context: any) {
              const value = context.parsed.y || 0;
              const datasetLabel = context.dataset.label || '';
              const fn = formatNumberRef.current;
              const tr = tRef.current;
              
              if (datasetLabel === tr('strategies:averageRate', { defaultValue: 'Moyenne' })) {
                return `${datasetLabel}: ${fn(value, 2)}%`;
              }
              
              const rawData = evolutionDataRef.current?.rawData;
              const aggregation = evolutionDataRef.current?.aggregation;
              const dayData = rawData?.[context.dataIndex];
              if (!dayData) return `${datasetLabel}: ${fn(value, 2)}%`;
              
              const totalStrategies = dayData.total_strategies || 0;
              const respected = dayData.respected || 0;
              const count = dayData.count || 1;
              
              let periodLabel = '';
              if (aggregation === 'week' || aggregation === 'month' || aggregation === 'year') {
                periodLabel = count === 1
                  ? `(${fn(count, 0)} ${tr('strategies:day', { defaultValue: 'jour' })})`
                  : `(${fn(count, 0)} ${tr('strategies:days', { defaultValue: 'jours' })})`;
              }

              return `${datasetLabel}: ${fn(value, 2)}% ${totalStrategies > 0 ? `(${fn(respected, 0)}/${fn(totalStrategies, 0)})` : ''} ${periodLabel}`;
            },
          },
          }),
        },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: function(value: any) {
              return `${formatNumberRef.current(Number(value), 0)}%`;
            },
            color: chartColors.textSecondary,
            font: {
              size: windowSize.isMobile ? 10 : 12,
            },
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            lineWidth: 1,
            drawBorder: false,
          },
          border: {
            color: chartColors.border,
            display: false,
          },
          title: {
            display: true,
            text: tRef.current('strategies:compliance.rate'),
            color: chartColors.text,
            font: {
              size: windowSize.isMobile ? 11 : 13,
              weight: 600,
            },
          },
        },
        x: {
          ticks: {
            color: chartColors.textSecondary,
            font: {
              size: windowSize.isMobile ? 10 : 12,
            },
            maxRotation: 45,
            minRotation: 45,
          },
          grid: {
            display: false,
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
      elements: {
        point: {
          hoverRadius: 4,
          hoverBorderWidth: 2,
        },
        bar: {
          borderRadius: 4,
        },
      },
    };
  }, [chartColors, windowSize.isMobile, optimizedAnimation, isDark]);

  // Weekday compliance chart options
  const weekdayComplianceOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: optimizedAnimation,
    indexAxis: 'x' as const,
    onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
      if (!elements.length) return;
      const handler = onChartDrillDownRefLocal.current?.current;
      const dayStats = weekdayComplianceDataRef.current?.dayStats;
      const dayData = dayStats?.[elements[0].index];
      if (!handler || !dayData || dayData.count === 0) return;
      handler({ type: 'weekday', dayIndex: dayData.dayIndex });
    },
    onHover: (event: ChartEvent, elements: ActiveElement[]) => {
      const canvas = event.native?.target as HTMLElement | undefined;
      if (!canvas) return;
      const dayStats = weekdayComplianceDataRef.current?.dayStats;
      const dayData = elements[0] ? dayStats?.[elements[0].index] : undefined;
      canvas.style.cursor = elements.length && dayData && dayData.count > 0 ? 'pointer' : 'default';
    },
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        display: function(context: any) {
          return context.dataset.type !== 'line';
        },
        color: '#ffffff',
        font: {
          weight: 600,
          size: windowSize.isMobile ? 10 : 12,
        },
        formatter: function(value: number) {
          return formatNumberRef.current(value, 2) + '%';
        },
        anchor: 'center' as const,
        align: 'center' as const,
        clamp: true,
      },
      tooltip: {
        ...buildChartTooltipPlugin(chartColors, 'lineMultiSeries', undefined, {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y || 0;
            const datasetType = context.dataset.type || 'bar';
            const fn = formatNumberRef.current;
            const tr = tRef.current;

            if (datasetType === 'line') {
              return `${context.dataset.label}: ${fn(value, 2)}%`;
            }

            const dayStats = weekdayComplianceDataRef.current?.dayStats;
            const dayData = dayStats?.[context.dataIndex];
            const count = dayData?.count || 0;
            const dayName = context.label || '';

            if (count === 0) {
              return `${context.dataset.label}: ${fn(value, 2)}%`;
            }

            const locale = i18nLanguageRef.current || 'fr';
            const dayLabel = tr('strategies:tooltips.dayLabel', {
              defaultValue: dayName,
              day: dayName,
              dayOriginal: dayName,
              locale,
            });

            const baseParams = {
              label: context.dataset.label,
              value: fn(value, 2),
              count: fn(count, 0),
              day: dayLabel,
              dayLabel,
              dayOriginal: dayName,
              locale,
            } as const;

            const basedOnText = tr('strategies:tooltips.basedOn', {
              defaultValue: 'basé sur {{count}} {{dayLabel}}',
              ...baseParams,
            });

            return tr('strategies:tooltips.respectByWeekday', {
              defaultValue: '{{label}}: {{value}}% ({{basedOn}})',
              basedOn: basedOnText,
              ...baseParams,
            });
          },
        },
        }),
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return `${formatNumberRef.current(Number(value), 0)}%`;
          },
          color: chartColors.textSecondary,
          font: {
            size: windowSize.isMobile ? 10 : 12,
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
          display: true,
          text: tRef.current('strategies:compliance.rate'),
          color: chartColors.text,
          font: {
            size: windowSize.isMobile ? 11 : 13,
            weight: 600,
          },
        },
      },
      x: {
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: windowSize.isMobile ? 10 : 12,
          },
        },
        grid: {
          display: false,
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: false,
        },
      },
    },
  }), [chartColors, windowSize.isMobile, optimizedAnimation]);

  return {
    respectChartOptions,
    successRateOptions,
    winningSessionsOptions,
    emotionsOptions,
    evolutionOptions,
    weekdayComplianceOptions,
  };
};
