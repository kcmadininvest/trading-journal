import React from 'react';
import { MetricCard } from './MetricCard';
import { MetricGauge, MetricGaugeConfig } from './MetricGauge';

interface MetricCardWithGaugeProps {
  title: string;
  icon?: React.ReactNode;
  metrics: Array<{
    label: string;
    value: number;
    config: MetricGaugeConfig;
    tooltip?: string;
    formatValue?: (value: number) => string;
    showLabels?: boolean;
  }>;
  variant?: 'hero' | 'standard' | 'compact';
  className?: string;
}

export const MetricCardWithGauge: React.FC<MetricCardWithGaugeProps> = ({
  title,
  icon,
  metrics,
  variant = 'standard',
  className = '',
}) => {
  return (
    <MetricCard title={title} icon={icon} variant={variant} className={className}>
      <div className="space-y-4">
        {metrics.map((metric, index) => (
          <MetricGauge
            key={index}
            label={metric.label}
            value={metric.value}
            config={metric.config}
            tooltip={metric.tooltip}
            formatValue={metric.formatValue}
            showLabels={metric.showLabels !== undefined ? metric.showLabels : index === metrics.length - 1}
            size="md"
          />
        ))}
      </div>
    </MetricCard>
  );
};
