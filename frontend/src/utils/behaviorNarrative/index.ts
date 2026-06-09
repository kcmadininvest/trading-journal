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
  resolveRiskSectionTitle,
  RISK_DRAWDOWN_MODERATE_MAX_PCT,
  RISK_DRAWDOWN_ELEVATED_MAX_PCT,
} from './resolveRiskSectionTitle';
export {
  BEHAVIOR_NARRATIVE_MIN_TRADES,
  BEHAVIOR_NARRATIVE_MIN_TRADES_PER_HOUR,
} from './types';
export { aggregateHourlyPerformance, aggregateWeeklyPerformance } from './aggregateBehaviorTimeContext';
export { buildBehaviorNarrativeContext } from './buildBehaviorNarrativeContext';
export { buildBehaviorNarrative } from './buildBehaviorNarrative';
