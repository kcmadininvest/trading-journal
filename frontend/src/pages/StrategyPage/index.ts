// Composant principal
export { default as StrategyPage } from '../StrategyPage';

// Hooks
export { useStrategyData } from './hooks/useStrategyData';
export { useCalendarData } from './hooks/useCalendarData';
export { useStrategyNavigation } from './hooks/useStrategyNavigation';

// Composants
export { default as StrategyHeader } from './components/StrategyHeader';
export { default as StrategyTabs } from './components/StrategyTabs';
export { default as CalendarView } from './components/CalendarView/CalendarView';
export { default as GlobalView } from './components/GlobalView/GlobalView';

// Charts
export * from './components/Charts';

// Types
export * from './types/strategy.types';
