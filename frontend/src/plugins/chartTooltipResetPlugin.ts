import type { ChartType, Plugin } from 'chart.js';
import { hideChartTooltip } from '../utils/chartTooltipReset';

/** Réinitialise le tooltip au `mouseout` du canvas (complète le conteneur `onMouseLeave`). */
export const chartTooltipResetPlugin: Plugin<ChartType> = {
  id: 'chartTooltipReset',
  beforeEvent(chart, args) {
    if (args.event.type === 'mouseout') {
      hideChartTooltip(chart);
    }
  },
};
