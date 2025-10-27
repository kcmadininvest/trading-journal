import React from 'react';
import { TradingAccount } from '../../../../../types';
import YearlySessionWinRateChart from '../../../../../components/Strategy/YearlySessionWinRateChart';

interface YearlySessionWinRateChartWrapperProps {
  year: number;
  selectedAccount: TradingAccount | null;
  isLoading: boolean;
}

const YearlySessionWinRateChartWrapper: React.FC<YearlySessionWinRateChartWrapperProps> = ({
  year,
  selectedAccount,
  isLoading
}) => {
  return (
    <div className="flex-1">
      <YearlySessionWinRateChart 
        year={year} 
        selectedAccount={selectedAccount} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default YearlySessionWinRateChartWrapper;
