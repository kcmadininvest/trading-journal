import React from 'react';

export type BehaviorMetricTone = 'positive' | 'negative';

interface BehaviorDisciplineMetricCardProps {
  label: string;
  value: string;
  unit?: string;
  tone: BehaviorMetricTone;
  badge?: string;
}

const toneClasses: Record<BehaviorMetricTone, { card: string; value: string; border: string }> = {
  positive: {
    card: 'bg-green-50/80 dark:bg-green-900/15',
    value: 'text-green-800 dark:text-green-300',
    border: 'border-green-700 dark:border-green-500',
  },
  negative: {
    card: 'bg-red-50/80 dark:bg-red-900/15',
    value: 'text-red-800 dark:text-red-300',
    border: 'border-red-700 dark:border-red-500',
  },
};

export const BehaviorDisciplineMetricCard: React.FC<BehaviorDisciplineMetricCardProps> = ({
  label,
  value,
  unit,
  tone,
  badge,
}) => {
  const classes = toneClasses[tone];

  return (
    <div
      className={`rounded-lg border border-gray-200/80 dark:border-gray-600/80 border-l-4 ${classes.border} ${classes.card} px-4 py-3 sm:px-5 sm:py-4`}
    >
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${classes.value}`}>
          {value}
        </span>
        {unit ? (
          <span className="text-sm text-gray-600 dark:text-gray-400">{unit}</span>
        ) : null}
        {badge ? (
          <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-800 dark:text-red-300">
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
};
