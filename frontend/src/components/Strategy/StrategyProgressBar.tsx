import React from 'react';

interface StrategyProgressBarProps {
  respectPercentage: number;
  totalTrades: number;
  respectedTrades: number;
  isLoading?: boolean;
}

export const StrategyProgressBar: React.FC<StrategyProgressBarProps> = ({
  respectPercentage,
  totalTrades,
  respectedTrades,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="w-64 h-20 bg-gray-200 rounded-lg animate-pulse" />
    );
  }

  const percentage = Math.round(respectPercentage);
  const colorClass = percentage >= 75 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 w-64">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Respect stratégie</span>
        <span className="text-sm font-semibold text-gray-900">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 mb-1">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 text-center">
        {respectedTrades} / {totalTrades} trades respectés
      </div>
    </div>
  );
};

