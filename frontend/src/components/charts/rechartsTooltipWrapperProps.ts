/** Props Recharts `Tooltip` — fond transparent pour laisser `ChartHoverTooltip` gérer le style. */
export const rechartsTooltipWrapperProps = {
  wrapperStyle: { outline: 'none', zIndex: 50 },
  contentStyle: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    boxShadow: 'none',
  },
  itemStyle: { padding: 0, margin: 0 },
  labelStyle: { margin: 0 },
} as const;
