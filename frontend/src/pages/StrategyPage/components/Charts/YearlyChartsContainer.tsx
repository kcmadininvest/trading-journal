import React from 'react';
import { TradingAccount } from '../../../../types';
import {
  YearlyStrategyRespectChartWrapper,
  YearlyWinRateByStrategyChartWrapper,
  YearlySessionWinRateChartWrapper,
  YearlyEmotionsChartWrapper
} from './Yearly';

interface YearlyChartsContainerProps {
  year: number;
  selectedAccount: TradingAccount | null;
  isLoading: boolean;
  position: 'left' | 'right';
}

const YearlyChartsContainer: React.FC<YearlyChartsContainerProps> = ({
  year,
  selectedAccount,
  isLoading,
  position
}) => {
  if (position === 'left') {
    return (
      <div className="flex flex-col space-y-4">
        <YearlyStrategyRespectChartWrapper 
          year={year} 
          selectedAccount={selectedAccount} 
          isLoading={isLoading} 
        />
        <YearlyWinRateByStrategyChartWrapper 
          year={year} 
          selectedAccount={selectedAccount} 
          isLoading={isLoading} 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <YearlySessionWinRateChartWrapper 
        year={year} 
        selectedAccount={selectedAccount} 
        isLoading={isLoading} 
      />
      <YearlyEmotionsChartWrapper 
        year={year} 
        selectedAccount={selectedAccount} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default YearlyChartsContainer;
