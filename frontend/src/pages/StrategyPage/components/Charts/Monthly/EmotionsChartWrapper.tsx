import React from 'react';
import { StrategyDataMap } from '../../../types/strategy.types';
import EmotionsChart from '../../../../../components/Strategy/EmotionsChart';

interface EmotionsChartWrapperProps {
  strategyData: StrategyDataMap;
  isLoading: boolean;
}

const EmotionsChartWrapper: React.FC<EmotionsChartWrapperProps> = ({
  strategyData,
  isLoading
}) => {
  return (
    <div className="flex-1">
      <EmotionsChart strategyData={strategyData} isLoading={isLoading} />
    </div>
  );
};

export default EmotionsChartWrapper;
