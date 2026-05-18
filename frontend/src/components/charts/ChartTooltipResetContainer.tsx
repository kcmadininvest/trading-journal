import React, { useCallback, useRef } from 'react';
import { hideChartTooltipInContainer } from '../../utils/chartTooltipReset';

interface ChartTooltipResetContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Masque le tooltip Chart.js quand le pointeur quitte la zone du graphique
 * (y compris padding autour du canvas, non couvert par le mouseout canvas seul).
 */
export const ChartTooltipResetContainer: React.FC<ChartTooltipResetContainerProps> = ({
  children,
  className = 'relative h-full w-full min-h-0',
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseLeave = useCallback(() => {
    hideChartTooltipInContainer(containerRef.current);
  }, []);

  return (
    <div ref={containerRef} className={className} style={style} onMouseLeave={handleMouseLeave}>
      {children}
    </div>
  );
};
