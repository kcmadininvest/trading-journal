import React from 'react';
import { TradingAccount } from '../../../../../types';
import YearlyStrategyRespectChart from '../../../../../components/Strategy/YearlyStrategyRespectChart';

interface YearlyStrategyRespectChartWrapperProps {
  year: number;
  selectedAccount: TradingAccount | null;
  isLoading: boolean;
}

const YearlyStrategyRespectChartWrapper: React.FC<YearlyStrategyRespectChartWrapperProps> = ({
  year,
  selectedAccount,
  isLoading
}) => {
  return (
    <div className="flex-1">
      <YearlyStrategyRespectChart 
        year={year} 
        selectedAccount={selectedAccount} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default YearlyStrategyRespectChartWrapper;
