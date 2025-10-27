import React from 'react';
import { StrategyDataMap } from '../../../types/strategy.types';
import WinRateByStrategyChart from '../../../../../components/Strategy/WinRateByStrategyChart';

interface WinRateByStrategyChartWrapperProps {
  strategyData: StrategyDataMap;
  isLoading: boolean;
}

const WinRateByStrategyChartWrapper: React.FC<WinRateByStrategyChartWrapperProps> = ({
  strategyData,
  isLoading
}) => {
  return (
    <div className="flex-1">
      <WinRateByStrategyChart strategyData={strategyData} isLoading={isLoading} />
    </div>
  );
};

export default WinRateByStrategyChartWrapper;
