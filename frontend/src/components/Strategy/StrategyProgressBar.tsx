import React from 'react';

interface StrategyProgressBarProps {
  respectPercentage: number;
  totalTrades: number;
  respectedTrades: number;
  isLoading?: boolean;
}

const StrategyProgressBar: React.FC<StrategyProgressBarProps> = ({ 
  respectPercentage, 
  totalTrades, 
  respectedTrades, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-base text-gray-500">Chargement...</div>
        <div className="w-48 h-3 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
    );
  }

  if (totalTrades === 0) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-base text-gray-500">Aucun trade</div>
        <div className="w-48 h-3 bg-gray-200 rounded-full"></div>
      </div>
    );
  }

  // Fonction pour calculer la couleur graduelle
  const getGradualColor = (percentage: number) => {
    // Transition graduelle du rouge au vert
    // Rouge pur à 0%, vert pur à 100%
    const red = Math.max(0, Math.min(255, 255 - (percentage * 2.55)));
    const green = Math.max(0, Math.min(255, percentage * 2.55));
    const blue = 0;
    
    return `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
  };


  return (
    <div className="flex items-center gap-4">
      <div className="text-base text-gray-700">
        <span className="font-semibold">Respect global de la stratégie :</span>
        <span 
          className="ml-2 font-bold text-lg"
          style={{ color: getGradualColor(respectPercentage) }}
        >
          {Math.round(respectPercentage)}%
        </span>
        <span className="text-sm text-gray-600 ml-2">
          ({respectedTrades}/{totalTrades})
        </span>
      </div>
      <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div 
          className="h-full transition-all duration-500 ease-out"
          style={{ 
            width: `${Math.min(respectPercentage, 100)}%`,
            backgroundColor: getGradualColor(respectPercentage)
          }}
        />
      </div>
    </div>
  );
};

export default StrategyProgressBar;
