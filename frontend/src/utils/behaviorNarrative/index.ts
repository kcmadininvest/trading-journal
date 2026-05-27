export type {
  BehaviorNarrativeContext,
  BuildBehaviorNarrativeInput,
  NarrativeSection,
  NarrativeSectionId,
  NarrativeTone,
} from './types';
export { classifyNarrativeTone, computeTrajectorySignals } from './classifyNarrativeTone';
export { resolveSectionTitle } from './resolveSectionTitle';
export {
  BEHAVIOR_NARRATIVE_MIN_TRADES,
  BEHAVIOR_NARRATIVE_MIN_TRADES_PER_HOUR,
} from './types';
export { aggregateHourlyPerformance, aggregateWeeklyPerformance } from './aggregateBehaviorTimeContext';
export { buildBehaviorNarrativeContext } from './buildBehaviorNarrativeContext';
export { buildBehaviorNarrative } from './buildBehaviorNarrative';
