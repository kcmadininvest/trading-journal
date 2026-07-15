import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from 'chart.js';
import { Bar as ChartBar, Doughnut as ChartDoughnut, Line as ChartLine, Chart as ChartComponent } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';

// Self-register Chart.js pieces so strategy charts don't depend on page-level registration
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  ChartTooltip,
  ChartLegend
);

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
