import { ChartOptions } from 'chart.js';

interface ChartColors {
  text: string;
  textSecondary: string;
  background: string;
  grid: string;
  border: string;
  tooltipBg: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipBorder: string;
}

interface WindowSize {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export const getChartColors = (isDark: boolean): ChartColors => ({
  text: isDark ? '#d1d5db' : '#374151',
  textSecondary: isDark ? '#9ca3af' : '#6b7280',
  background: isDark ? '#1f2937' : '#ffffff',
  grid: isDark ? '#374151' : '#e5e7eb',
  border: isDark ? '#4b5563' : '#d1d5db',
  tooltipBg: isDark ? '#374151' : '#ffffff',
  tooltipTitle: isDark ? '#d1d5db' : '#4b5563',
  tooltipBody: isDark ? '#f3f4f6' : '#1f2937',
  tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
});

interface BaseChartOptionsParams {
  chartColors: ChartColors;
  isMobile: boolean;
  showLegend?: boolean;
  showDataLabels?: boolean;
  yAxisLabel?: string;
  yAxisMax?: number;
  stacked?: boolean;
}

export const createBaseChartOptions = ({
  chartColors,
  isMobile,
  showLegend = true,
  showDataLabels = true,
  yAxisLabel,
  yAxisMax,
  stacked = false,
}: BaseChartOptionsParams): Partial<ChartOptions<any>> => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: showLegend,
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: isMobile ? 12 : 20,
        font: {
          size: isMobile ? 10 : 12,
        },
        color: chartColors.textSecondary,
      },
    },
    datalabels: {
      display: showDataLabels,
      color: '#ffffff',
      font: {
        weight: 600,
        size: isMobile ? 10 : 13,
      },
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
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      stacked,
      max: yAxisMax,
      ticks: {
        color: chartColors.textSecondary,
        font: {
          size: isMobile ? 10 : 12,
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
      title: yAxisLabel ? {
        display: true,
        text: yAxisLabel,
        color: chartColors.text,
        font: {
          size: isMobile ? 11 : 13,
          weight: 600,
        },
      } : {
        display: false,
      },
    },
    x: {
      stacked,
      ticks: {
        color: chartColors.textSecondary,
        font: {
          size: isMobile ? 10 : 12,
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
});

export const generateChartColors = (count: number): { backgroundColor: string[]; borderColor: string[] } => {
  const baseColors = [
    { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },
    { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },
    { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgb(239, 68, 68)' },
    { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgb(251, 191, 36)' },
    { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' },
    { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },
    { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgb(20, 184, 166)' },
    { bg: 'rgba(249, 115, 22, 0.8)', border: 'rgb(249, 115, 22)' },
    { bg: 'rgba(6, 182, 212, 0.8)', border: 'rgb(6, 182, 212)' },
    { bg: 'rgba(132, 204, 22, 0.8)', border: 'rgb(132, 204, 22)' },
    { bg: 'rgba(234, 179, 8, 0.8)', border: 'rgb(234, 179, 8)' },
    { bg: 'rgba(225, 29, 72, 0.8)', border: 'rgb(225, 29, 72)' },
    { bg: 'rgba(139, 92, 246, 0.8)', border: 'rgb(139, 92, 246)' },
    { bg: 'rgba(14, 165, 233, 0.8)', border: 'rgb(14, 165, 233)' },
    { bg: 'rgba(5, 150, 105, 0.8)', border: 'rgb(5, 150, 105)' },
    { bg: 'rgba(217, 119, 6, 0.8)', border: 'rgb(217, 119, 6)' },
    { bg: 'rgba(190, 24, 93, 0.8)', border: 'rgb(190, 24, 93)' },
    { bg: 'rgba(99, 102, 241, 0.8)', border: 'rgb(99, 102, 241)' },
  ];

  const colors: string[] = [];
  const borders: string[] = [];
  for (let i = 0; i < count; i++) {
    const color = baseColors[i % baseColors.length];
    colors.push(color.bg);
    borders.push(color.border);
  }
  return { backgroundColor: colors, borderColor: borders };
};

// Factory pour créer les options de base d'un graphique en barres
export const createBarChartOptions = (
  chartColors: ChartColors,
  windowSize: WindowSize,
  options: {
    stacked?: boolean;
    maxValue?: number;
    showPercentage?: boolean;
    yAxisTitle?: string;
  } = {}
): Partial<ChartOptions<'bar'>> => {
  const { stacked = false, maxValue, showPercentage = false, yAxisTitle } = options;

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: windowSize.isMobile ? 12 : 20,
          font: {
            size: windowSize.isMobile ? 10 : 12,
          },
          color: chartColors.textSecondary,
        },
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
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked,
        ...(maxValue && { max: maxValue }),
        ticks: {
          callback: showPercentage ? (value: any) => value + '%' : undefined,
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
        ...(yAxisTitle && {
          title: {
            display: true,
            text: yAxisTitle,
            color: chartColors.text,
            font: {
              size: windowSize.isMobile ? 11 : 13,
              weight: 600,
            },
          },
        }),
      },
      x: {
        stacked,
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
  };
};

// Factory pour créer les options d'un graphique en ligne
export const createLineChartOptions = (
  chartColors: ChartColors,
  windowSize: WindowSize,
  options: {
    yMin?: number;
    yMax?: number;
    showPercentage?: boolean;
    yAxisTitle?: string;
    xAxisRotation?: number;
  } = {}
): Partial<ChartOptions<'line'>> => {
  const { yMin, yMax, showPercentage = false, yAxisTitle, xAxisRotation = 0 } = options;

  return {
    responsive: true,
    maintainAspectRatio: false,
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
            size: windowSize.isMobile ? 10 : 12,
          },
          color: chartColors.textSecondary,
        },
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
        displayColors: true,
      },
    },
    scales: {
      y: {
        ...(yMin !== undefined && { min: yMin }),
        ...(yMax !== undefined && { max: yMax }),
        ticks: {
          callback: showPercentage ? (value: any) => value + '%' : undefined,
          color: chartColors.textSecondary,
          font: {
            size: windowSize.isMobile ? 10 : 12,
          },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
        ...(yAxisTitle && {
          title: {
            display: true,
            text: yAxisTitle,
            color: chartColors.text,
            font: {
              size: windowSize.isMobile ? 11 : 13,
              weight: 600,
            },
          },
        }),
      },
      x: {
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: windowSize.isMobile ? 10 : 12,
          },
          ...(xAxisRotation > 0 && {
            maxRotation: xAxisRotation,
            minRotation: xAxisRotation,
          }),
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
      },
    },
    elements: {
      point: {
        hoverRadius: 6,
        hoverBorderWidth: 3,
      },
      line: {
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
      },
    },
  };
};
