import { ChartOptions } from 'chart.js';
import { chartColors } from '../config/chartConfig';

interface UseBarChartConfigOptions {
  layout?: {
    padding?: {
      bottom?: number;
      top?: number;
      left?: number;
      right?: number;
    };
  };
  plugins?: {
    legend?: {
      display?: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
      labels?: {
        usePointStyle?: boolean;
        padding?: number;
        font?: {
          size?: number;
        };
      };
    };
    datalabels?: {
      display?: boolean;
      color?: string | ((context: any) => string);
      font?: {
        weight?: number;
        size?: number;
      };
      formatter?: (value: number) => string;
    };
  };
  scales?: {
    x?: {
      stacked?: boolean;
      grid?: {
        display?: boolean;
      };
      ticks?: {
        padding?: number;
      };
    };
    y?: {
      stacked?: boolean;
      beginAtZero?: boolean;
      grid?: {
        color?: string;
      };
    };
  };
  elements?: {
    bar?: {
      borderRadius?: number;
    };
  };
  animation?: {
    duration?: number;
    easing?: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart' | 'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint' | 'easeInSine' | 'easeOutSine' | 'easeInOutSine' | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo' | 'easeInCirc' | 'easeOutCirc' | 'easeInOutCirc' | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic' | 'easeInBack' | 'easeOutBack' | 'easeInOutBack' | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce';
  };
}

export function useBarChartConfig(config?: UseBarChartConfigOptions): { options: ChartOptions<'bar'> } {
  const defaultOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: config?.layout && config.layout.padding ? {
      padding: Object.fromEntries(
        Object.entries(config.layout.padding).filter(([_, value]) => value !== undefined)
      ) as { bottom?: number; top?: number; left?: number; right?: number },
    } : undefined,
    plugins: {
      legend: {
        display: config?.plugins?.legend?.display ?? true,
        position: config?.plugins?.legend?.position ?? 'top',
        labels: {
          usePointStyle: config?.plugins?.legend?.labels?.usePointStyle ?? true,
          padding: config?.plugins?.legend?.labels?.padding ?? 20,
          font: {
            size: config?.plugins?.legend?.labels?.font?.size ?? 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#4b5563',
        bodyColor: '#1f2937',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 16,
        titleFont: {
          size: 14,
          weight: 600 as const,
        },
        bodyFont: {
          size: 13,
          weight: 500 as const,
        },
        displayColors: true,
      },
      datalabels: config?.plugins?.datalabels?.display ? {
        display: true,
        ...(config.plugins.datalabels.color !== undefined && {
          color: config.plugins.datalabels.color as any,
        }),
        ...(config.plugins.datalabels.font && {
          font: {
            weight: config.plugins.datalabels.font.weight,
            size: config.plugins.datalabels.font.size,
          },
        }),
        ...(config.plugins.datalabels.formatter && {
          formatter: config.plugins.datalabels.formatter as any,
        }),
      } : {
        display: false,
      },
    },
    scales: {
      x: {
        stacked: config?.scales?.x?.stacked ?? false,
        grid: {
          display: config?.scales?.x?.grid?.display ?? false,
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
          },
          padding: config?.scales?.x?.ticks?.padding,
        },
        border: {
          color: '#d1d5db',
        },
      },
      y: {
        stacked: config?.scales?.y?.stacked ?? false,
        beginAtZero: config?.scales?.y?.beginAtZero ?? true,
        grid: {
          color: config?.scales?.y?.grid?.color ?? chartColors.gray[200],
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
          },
        },
        border: {
          color: '#d1d5db',
          display: false,
        },
      },
    },
    elements: {
      bar: {
        borderRadius: config?.elements?.bar?.borderRadius ?? 0,
      },
    },
    animation: {
      duration: config?.animation?.duration ?? 1000,
      easing: (config?.animation?.easing ?? 'easeInOutQuart') as 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart' | 'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint' | 'easeInSine' | 'easeOutSine' | 'easeInOutSine' | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo' | 'easeInCirc' | 'easeOutCirc' | 'easeInOutCirc' | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic' | 'easeInBack' | 'easeOutBack' | 'easeInOutBack' | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce',
    },
  };

  return { options: defaultOptions };
}
