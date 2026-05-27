import type { NarrativeSectionId, NarrativeTone } from './types';

export type AlertsSectionState = 'warnings' | 'clean';
export type TrajectorySectionState = 'progression' | 'volatile' | 'neutral';

export function resolveSectionTitle(
  sectionId: NarrativeSectionId,
  tone: NarrativeTone,
  options?: {
    alertsState?: AlertsSectionState;
    trajectoryState?: TrajectorySectionState;
  },
): string {
  const { alertsState = 'clean', trajectoryState = 'neutral' } = options ?? {};

  switch (sectionId) {
    case 'strengths':
      return `behaviorNarrative.strengths.title.${tone}`;

    case 'alerts':
      if (alertsState === 'warnings') {
        return tone === 'challenging'
          ? 'behaviorNarrative.alerts.title.warningsChallenging'
          : 'behaviorNarrative.alerts.title.warnings';
      }
      if (tone === 'excellent' || tone === 'positive') {
        return 'behaviorNarrative.alerts.title.cleanCelebrate';
      }
      return `behaviorNarrative.alerts.title.clean.${tone}`;

    case 'timeWindows':
      return tone === 'excellent' || tone === 'positive'
        ? 'behaviorNarrative.timeWindows.title.celebrate'
        : `behaviorNarrative.timeWindows.title.${tone}`;

    case 'duration':
      return tone === 'excellent' || tone === 'positive'
        ? 'behaviorNarrative.duration.title.celebrate'
        : `behaviorNarrative.duration.title.${tone}`;

    case 'trajectory':
      if (trajectoryState === 'progression' && (tone === 'excellent' || tone === 'positive')) {
        return 'behaviorNarrative.trajectory.title.celebrate';
      }
      if (trajectoryState === 'volatile' && tone === 'challenging') {
        return 'behaviorNarrative.trajectory.title.encourage';
      }
      return `behaviorNarrative.trajectory.title.${tone}`;

    default:
      return `behaviorNarrative.${sectionId}.title`;
  }
}
