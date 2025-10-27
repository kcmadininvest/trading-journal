import React from 'react';
import { StrategyDataMap } from '../../../types/strategy.types';
import StrategyRespectChart from '../../../../../components/Strategy/StrategyRespectChart';

interface StrategyRespectChartWrapperProps {
  strategyData: StrategyDataMap;
  isLoading: boolean;
}

const StrategyRespectChartWrapper: React.FC<StrategyRespectChartWrapperProps> = ({
  strategyData,
  isLoading
}) => {
  return (
    <div className="flex-1">
      <StrategyRespectChart strategyData={strategyData} isLoading={isLoading} />
    </div>
  );
};

export default StrategyRespectChartWrapper;
