import React from 'react';
import { StrategyDataMap } from '../../../types/strategy.types';
import SessionWinRateChart from '../../../../../components/Strategy/SessionWinRateChart';

interface SessionWinRateChartWrapperProps {
  strategyData: StrategyDataMap;
  isLoading: boolean;
}

const SessionWinRateChartWrapper: React.FC<SessionWinRateChartWrapperProps> = ({
  strategyData,
  isLoading
}) => {
  return (
    <div className="flex-1">
      <SessionWinRateChart strategyData={strategyData} isLoading={isLoading} />
    </div>
  );
};

export default SessionWinRateChartWrapper;
