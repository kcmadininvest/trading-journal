import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatMarketPhaseEventActionLabel,
  MARKET_PHASE_EVENT_ACTIONS,
  type MarketPhaseEventAction,
} from '../../utils/marketPhaseEventDisplay';
import { activeExclusiveSlotEvent } from '../../utils/marketPhaseEventCapture';
import type { MarketPhaseEvent } from '../../services/marketPhases';

type EventDirection = 'up' | 'down' | 'neutral';

const DIRECTION_GROUPS: EventDirection[] = ['up', 'down', 'neutral'];

const ACTION_ORDER: Record<string, number> = {
  'range_breakout_up:body': 0,
  'range_breakout_up:wick': 1,
  'wick_sweep_high:wick': 2,
  'range_breakout_down:body': 0,
  'range_breakout_down:wick': 1,
  'wick_sweep_low:wick': 2,
  'range_reentry:unknown': 0,
};

function actionSortKey(action: MarketPhaseEventAction): number {
  return ACTION_ORDER[`${action.code}:${action.candlePart}`] ?? 99;
}

/** Associe un événement enregistré à une action bouton (outcome ignoré pour les cassures : fakeout). */
export function eventMatchesAction(ev: MarketPhaseEvent, action: MarketPhaseEventAction): boolean {
  if (ev.event_type_code !== action.code) return false;
  if ((ev.candle_part || 'unknown') !== action.candlePart) return false;
  if ((ev.direction || 'neutral') !== action.direction) return false;
  return true;
}

export function findEventForAction(
  events: MarketPhaseEvent[],
  action: MarketPhaseEventAction,
): MarketPhaseEvent | undefined {
  return events.find((ev) => eventMatchesAction(ev, action));
}

function buttonClassForDirection(direction: EventDirection, selected: boolean): string {
  const base =
    'inline-flex h-10 min-h-10 max-h-10 min-w-0 flex-1 items-center justify-center rounded-lg border px-2.5 font-sans text-sm font-medium leading-none transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900';
  if (direction === 'up') {
    return selected
      ? `${base} border-emerald-500/80 bg-emerald-600 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.28)] dark:border-emerald-400 dark:bg-emerald-500 dark:shadow-[0_0_0_3px_rgba(52,211,153,0.28)] focus-visible:ring-emerald-400`
      : `${base} border-emerald-200/90 bg-emerald-50/90 text-emerald-800 shadow-sm hover:border-emerald-400 hover:bg-emerald-100 hover:shadow dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/50 focus-visible:ring-emerald-400`;
  }
  if (direction === 'down') {
    return selected
      ? `${base} border-rose-500/80 bg-rose-600 text-white shadow-[0_0_0_3px_rgba(244,63,94,0.28)] dark:border-rose-400 dark:bg-rose-500 dark:shadow-[0_0_0_3px_rgba(251,113,133,0.28)] focus-visible:ring-rose-400`
      : `${base} border-rose-200/90 bg-rose-50/90 text-rose-800 shadow-sm hover:border-rose-400 hover:bg-rose-100 hover:shadow dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:border-rose-600 dark:hover:bg-rose-900/50 focus-visible:ring-rose-400`;
  }
  return selected
    ? `${base} border-sky-500/80 bg-sky-600 text-white shadow-[0_0_0_3px_rgba(14,165,233,0.28)] dark:border-sky-400 dark:bg-sky-500 dark:shadow-[0_0_0_3px_rgba(56,189,248,0.28)] focus-visible:ring-sky-400`
    : `${base} border-gray-200/90 bg-white text-gray-700 shadow-sm hover:border-sky-300 hover:bg-sky-50/80 hover:shadow dark:border-gray-600/80 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-sky-600 dark:hover:bg-gray-700 focus-visible:ring-sky-400`;
}

function groupLabelClass(direction: EventDirection): string {
  if (direction === 'up') {
    return 'font-sans text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300';
  }
  if (direction === 'down') {
    return 'font-sans text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300';
  }
  return 'font-sans text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400';
}

/** Direction d’affichage pour un événement enregistré (champ ou code). */
export function resolveEventDisplayDirection(ev: MarketPhaseEvent): EventDirection {
  if (ev.direction === 'up' || ev.direction === 'down' || ev.direction === 'neutral') {
    return ev.direction;
  }
  const code = ev.event_type_code || '';
  if (code === 'range_breakout_up' || code === 'wick_sweep_high') return 'up';
  if (code === 'range_breakout_down' || code === 'wick_sweep_low') return 'down';
  return 'neutral';
}

export interface MarketPhaseEventButtonsProps {
  occurredAt: string;
  mode: 'live' | 'replay';
  events?: MarketPhaseEvent[];
  /** Sélection exclusive : sélectionne, annule (reclic) ou remplace l’événement de la tranche. */
  onToggle: (action: MarketPhaseEventAction, occurredAt?: string) => void;
  className?: string;
}

export const MarketPhaseEventButtons: React.FC<MarketPhaseEventButtonsProps> = ({
  occurredAt,
  mode,
  events = [],
  onToggle,
  className = '',
}) => {
  const { t } = useTranslation('marketPhases');

  const groupedActions = useMemo(() => {
    const map: Record<EventDirection, MarketPhaseEventAction[]> = {
      up: [],
      down: [],
      neutral: [],
    };
    for (const action of MARKET_PHASE_EVENT_ACTIONS) {
      map[action.direction].push(action);
    }
    for (const dir of DIRECTION_GROUPS) {
      map[dir].sort((a, b) => actionSortKey(a) - actionSortKey(b));
    }
    return map;
  }, []);

  const handleToggle = (action: MarketPhaseEventAction) => {
    onToggle(action, mode === 'replay' ? occurredAt : undefined);
  };

  const activeEvent = useMemo(() => activeExclusiveSlotEvent(events), [events]);

  return (
    <div className={`w-full font-sans ${className}`}>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_minmax(6rem,0.7fr)]">
        {DIRECTION_GROUPS.map((direction) => {
          const actions = groupedActions[direction];
          if (actions.length === 0) return null;
          return (
            <div key={direction} className="flex h-10 min-w-0 items-center gap-1">
              <span className={`shrink-0 ${groupLabelClass(direction)}`} title={t(`events.directionGroup.${direction}`)}>
                {t(`events.directionGroup.${direction}`)}
              </span>
              <div className="flex h-10 min-w-0 flex-1 gap-1.5">
                {actions.map((action) => {
                  const selected = Boolean(activeEvent && eventMatchesAction(activeEvent, action));
                  return (
                    <button
                      key={`${action.code}:${action.candlePart}:${action.outcome}`}
                      type="button"
                      aria-pressed={selected}
                      className={buttonClassForDirection(direction, selected)}
                      title={t(action.previewKey)}
                      onClick={() => handleToggle(action)}
                    >
                      <span className="truncate">{formatMarketPhaseEventActionLabel(t, action)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
