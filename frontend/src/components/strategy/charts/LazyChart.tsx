import React from 'react';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import { ChartSkeleton } from './ChartSkeleton';

interface LazyChartProps {
  children: React.ReactNode;
  height?: string;
}

/**
 * Composant pour le lazy loading des graphiques
 * Charge le graphique uniquement quand il devient visible
 */
export const LazyChart: React.FC<LazyChartProps> = ({ children, height = 'h-64 sm:h-80 md:h-96' }) => {
  const [ref, isVisible] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px', // Charger 100px avant que le graphique soit visible
    triggerOnce: true,
  });

  return (
    <div ref={ref} className={height}>
      {isVisible ? children : <ChartSkeleton />}
    </div>
  );
};
