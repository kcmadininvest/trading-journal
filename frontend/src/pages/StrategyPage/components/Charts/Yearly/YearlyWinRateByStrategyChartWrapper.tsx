import React from 'react';
import { TradingAccount } from '../../../../../types';
import YearlyWinRateByStrategyChart from '../../../../../components/Strategy/YearlyWinRateByStrategyChart';

interface YearlyWinRateByStrategyChartWrapperProps {
  year: number;
  selectedAccount: TradingAccount | null;
  isLoading: boolean;
}

const YearlyWinRateByStrategyChartWrapper: React.FC<YearlyWinRateByStrategyChartWrapperProps> = ({
  year,
  selectedAccount,
  isLoading
}) => {
  return (
    <div className="flex-1">
      <YearlyWinRateByStrategyChart 
        year={year} 
        selectedAccount={selectedAccount} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default YearlyWinRateByStrategyChartWrapper;
