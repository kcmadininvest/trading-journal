import React from 'react';
import { TradingAccount } from '../../../../../types';
import YearlyEmotionsChart from '../../../../../components/Strategy/YearlyEmotionsChart';

interface YearlyEmotionsChartWrapperProps {
  year: number;
  selectedAccount: TradingAccount | null;
  isLoading: boolean;
}

const YearlyEmotionsChartWrapper: React.FC<YearlyEmotionsChartWrapperProps> = ({
  year,
  selectedAccount,
  isLoading
}) => {
  return (
    <div className="flex-1">
      <YearlyEmotionsChart 
        year={year} 
        selectedAccount={selectedAccount} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default YearlyEmotionsChartWrapper;
