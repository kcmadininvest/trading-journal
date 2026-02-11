import { useMemo, useRef } from 'react';
import type { EasingFunction } from 'chart.js';
import { WeekdayComplianceChartData } from './useWeekdayCompliance';

interface ChartColors {
  text: string;
  textSecondary: string;
  grid: string;
  border: string;
  tooltipBg: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipBorder: string;
}

interface UseChartOptionsParams {
  chartColors: ChartColors;
  windowSize: { isMobile: boolean; isTablet: boolean };
  isDark: boolean;
  optimizedAnimation: { duration: number; easing: EasingFunction };
  formatNumber: (value: number, digits?: number) => string;
  formatPeriod: (period: string) => string;
  t: any;
  i18nLanguage: string;
  // Volatile data passed via refs to avoid invalidating useMemo
  statistics: any;
  respectChartData: any;
  emotionsData: any;
  evolutionData: any;
  weekdayComplianceData: WeekdayComplianceChartData | null;
}

export const useChartOptions = ({
  chartColors,
  windowSize,
  isDark,
  optimizedAnimation,
  formatNumber,
  formatPeriod,
  t,
  i18nLanguage,
  statistics,
  respectChartData,
  emotionsData,
  evolutionData,
  weekdayComplianceData,
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

  const formatNumberRef = useRef(formatNumber);
  formatNumberRef.current = formatNumber;

  const formatPeriodRef = useRef(formatPeriod);
  formatPeriodRef.current = formatPeriod;

  const tRef = useRef(t);
  tRef.current = t;

  const i18nLanguageRef = useRef(i18nLanguage);
  i18nLanguageRef.current = i18nLanguage;

  // Respect chart options
  const respectChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: optimizedAnimation,
    plugins: {
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          weight: 600,
          size: windowSize.isMobile ? 10 : 13,
        },
        formatter: function(value: number) {
          return value > 0 ? formatNumberRef.current(value, 1) + '%' : '';
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
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
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
            const period = statisticsRef.current?.statistics?.period_data?.[context[0].dataIndex]?.period || '';
            return formatPeriodRef.current(period);
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
              return `${label}: ${fn(value, 2)}% (${count} ${tr('strategies:trades')} ${tr('strategies:on', { defaultValue: 'sur' })} ${totalTrades})`;
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
              return `${label}: ${fn(value, 2)}% (${elementTrades} ${tr('strategies:trades')} + ${elementDays} ${elementDays === 1 ? 'jour sans trade' : 'jours sans trades'} ${tr('strategies:on', { defaultValue: 'sur' })} ${totalWithStrategy})`;
            } else {
              return `${label}: ${fn(value, 2)}% (${elementTrades} ${tr('strategies:trades')} ${tr('strategies:on', { defaultValue: 'sur' })} ${totalWithStrategy})`;
            }
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
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
          color: chartColors.grid,
          lineWidth: 1,
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
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
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
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${formatNumberRef.current(value, 2)}%`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return value + '%';
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
      plugins: {
        datalabels: {
          display: true,
          color: '#ffffff',
          font: {
            weight: 600,
            size: windowSize.isMobile ? 10 : 13,
          },
          formatter: function(value: number) {
            return value > 0 ? value.toString() : '';
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
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.tooltipTitle,
          bodyColor: chartColors.tooltipBody,
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
              return context[0].label || '';
            },
            label: function(context: any) {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              const total = statisticsRef.current?.statistics?.winning_sessions_distribution?.total_winning || 1;
              const percentage = total > 0 ? (value / total) * 100 : 0;
              return `${label}: ${value} (${formatNumberRef.current(percentage, 1)}%)`;
            },
          },
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
            color: chartColors.grid,
            lineWidth: 1,
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
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
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
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = emotionsDataRef.current?.total || 1;
            const percentage = total > 0 ? (value / total) * 100 : 0;
            return `${label}: ${value} (${formatNumberRef.current(percentage, 1)}%)`;
          },
        },
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
            return context.dataset.type !== 'line';
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
          mode: 'index' as const,
          intersect: false,
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.tooltipTitle,
          bodyColor: chartColors.tooltipBody,
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
          displayColors: true,
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
                  ? `(${count} ${tr('strategies:day', { defaultValue: 'jour' })})`
                  : `(${count} ${tr('strategies:days', { defaultValue: 'jours' })})`;
              }
              
              return `${datasetLabel}: ${fn(value, 2)}% ${totalStrategies > 0 ? `(${respected}/${totalStrategies})` : ''} ${periodLabel}`;
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: function(value: any) {
              return value + '%';
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
            color: 'rgba(148, 163, 184, 0.1)',
            lineWidth: 1,
            drawBorder: false,
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
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: chartColors.text,
          usePointStyle: true,
          padding: 16,
        },
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
          return formatNumberRef.current(value, 1) + '%';
        },
        anchor: 'end' as const,
        align: 'start' as const,
        offset: -6,
        clamp: true,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
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
        displayColors: true,
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
              count,
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
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
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
          color: chartColors.grid,
          lineWidth: 1,
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
