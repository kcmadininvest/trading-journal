/** Couleurs PnL replay — alignées sur getReplayPnlTextClass / SessionPnlChart. */
export interface ReplayPnlColors {
  positive: string;
  positiveMuted: string;
  negative: string;
  negativeMuted: string;
}

export function getReplayPnlColors(isDark: boolean): ReplayPnlColors {
  if (isDark) {
    return {
      positive: '#4ade80',
      positiveMuted: '#16a34a',
      negative: '#f87171',
      negativeMuted: '#dc2626',
    };
  }
  return {
    positive: '#16a34a',
    positiveMuted: '#15803d',
    negative: '#dc2626',
    negativeMuted: '#b91c1c',
  };
}
