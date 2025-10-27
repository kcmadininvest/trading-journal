import React from 'react';
import { StrategyDataMap } from '../../types/strategy.types';
import {
  StrategyRespectChartWrapper,
  WinRateByStrategyChartWrapper,
  SessionWinRateChartWrapper,
  EmotionsChartWrapper
} from './Monthly';

interface ChartsContainerProps {
  strategyData: StrategyDataMap;
  isLoading: boolean;
  type: 'monthly' | 'yearly';
  position?: 'left' | 'right';
}

const ChartsContainer: React.FC<ChartsContainerProps> = ({
  strategyData,
  isLoading,
  type,
  position = 'left'
}) => {
  if (type !== 'monthly') {
    return null; // Les graphiques annuels sont gérés par YearlyChartsContainer
  }

  if (position === 'left') {
    return (
      <div className="flex flex-col space-y-4">
        <StrategyRespectChartWrapper 
          strategyData={strategyData} 
          isLoading={isLoading} 
        />
        <WinRateByStrategyChartWrapper 
          strategyData={strategyData} 
          isLoading={isLoading} 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <SessionWinRateChartWrapper 
        strategyData={strategyData} 
        isLoading={isLoading} 
      />
      <EmotionsChartWrapper 
        strategyData={strategyData} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default ChartsContainer;
