import React from 'react';
import { MarketDSTIndicator } from './MarketDSTIndicator';

interface NYSEDSTIndicatorProps {
  className?: string;
}

export const NYSEDSTIndicator: React.FC<NYSEDSTIndicatorProps> = ({ className = '' }) => {
  return (
    <MarketDSTIndicator
      region="US"
      marketCode="NYSE"
      marketName="NYSE"
      flagCode="us"
      color="blue"
      showTimezoneOffset={false}
      className={className}
    />
  );
};

export default NYSEDSTIndicator;
