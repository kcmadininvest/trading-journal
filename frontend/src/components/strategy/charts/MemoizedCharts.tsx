import React from 'react';
import { Bar as ChartBar, Doughnut as ChartDoughnut, Line as ChartLine, Chart as ChartComponent } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';

// Fonction de comparaison personnalisée pour les props des graphiques
const areChartPropsEqual = (prevProps: any, nextProps: any) => {
  // Comparer les données et options par référence (grâce à useMemo dans le parent)
  return (
    prevProps.data === nextProps.data &&
    prevProps.options === nextProps.options &&
    prevProps.type === nextProps.type
  );
};

// Composants mémoïsés pour éviter les re-renders inutiles
export const MemoizedBar = React.memo(ChartBar, areChartPropsEqual);
export const MemoizedDoughnut = React.memo(ChartDoughnut, areChartPropsEqual);
export const MemoizedLine = React.memo(ChartLine, areChartPropsEqual);
export const MemoizedMixedChart = React.memo(ChartComponent, areChartPropsEqual);

// Types pour TypeScript
export type { ChartOptions };
