import React from 'react';
import { MarketDSTIndicator } from './MarketDSTIndicator';

interface EuronextDSTIndicatorProps {
  className?: string;
}

export const EuronextDSTIndicator: React.FC<EuronextDSTIndicatorProps> = ({ className = '' }) => {
  return (
    <MarketDSTIndicator
      region="EU"
      marketCode="XPAR"
      marketName="Euronext Paris"
      flagCode="fr"
      color="purple"
      className={className}
    />
  );
};

export default EuronextDSTIndicator;
