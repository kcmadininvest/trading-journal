import React from 'react';
import Tooltip from '../ui/Tooltip';

interface ChartHelpTooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

/** Icône d'aide standard pour les cartes graphiques (Analytics, Statistiques). */
export const ChartHelpTooltip: React.FC<ChartHelpTooltipProps> = ({
  content,
  position = 'top',
  delay = 200,
}) => (
  <Tooltip content={content} position={position} delay={delay} contentClassName="whitespace-pre-line block">
    <div className="flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full bg-gray-200 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600">
      <svg className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  </Tooltip>
);
