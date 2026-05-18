import { Chart as ChartJS } from 'chart.js';

/** Masque le tooltip Chart.js et réinitialise les éléments actifs (hover). */
export function hideChartTooltip(chart: ChartJS | null | undefined): void {
  if (!chart) return;

  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.update('none');
}

/** Résout l’instance Chart.js à partir d’un canvas dans un conteneur. */
export function hideChartTooltipInContainer(container: HTMLElement | null | undefined): void {
  if (!container) return;
  const canvas = container.querySelector('canvas');
  if (!canvas) return;
  hideChartTooltip(ChartJS.getChart(canvas));
}
