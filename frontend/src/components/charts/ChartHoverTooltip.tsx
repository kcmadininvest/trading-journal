import React from 'react';
import { CHART_FONT_FAMILY, type ChartColors } from '../../utils/chartConfig';

export interface ChartHoverTooltipProps {
  chartColors: ChartColors;
  title?: string;
  lines: string[];
}

/** Infobulle au survol — styles alignés sur `buildChartTooltipPlugin` (Chart.js). */
export const ChartHoverTooltip: React.FC<ChartHoverTooltipProps> = ({
  chartColors,
  title,
  lines,
}) => (
  <div
    style={{
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      borderWidth: 1,
      borderStyle: 'solid',
      padding: 16,
      borderRadius: 6,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      fontFamily: CHART_FONT_FAMILY,
    }}
  >
    {title ? (
      <p
        style={{
          color: chartColors.tooltipTitle,
          fontSize: 14,
          fontWeight: 600,
          margin: 0,
          marginBottom: lines.length > 0 ? 8 : undefined,
        }}
      >
        {title}
      </p>
    ) : null}
    {lines.map((line, index) => (
      <p
        key={index}
        style={{
          color: chartColors.tooltipBody,
          fontSize: 13,
          fontWeight: 500,
          margin: 0,
          marginTop: index > 0 ? 4 : undefined,
        }}
      >
        {line}
      </p>
    ))}
  </div>
);
