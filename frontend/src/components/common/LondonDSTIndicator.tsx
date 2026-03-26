import React from 'react';
import { MarketDSTIndicator } from './MarketDSTIndicator';

interface LondonDSTIndicatorProps {
  className?: string;
}

export const LondonDSTIndicator: React.FC<LondonDSTIndicatorProps> = ({ className = '' }) => {
  return (
    <MarketDSTIndicator
      region="EU"
      marketCode="XLON"
      marketName="London Stock Exchange"
      flagCode="gb"
      color="red"
      className={className}
    />
  );
};

export default LondonDSTIndicator;
