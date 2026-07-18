import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatMarketPhaseEventActionLabel,
  getMarketPhaseEventActionByKey,
  MARKET_PHASE_EVENT_ACTIONS,
  marketPhaseEventActionKey,
  type MarketPhaseEventAction,
} from '../../utils/marketPhaseEventDisplay';
import { activeSlotEvents, isRangeReentryEvent } from '../../utils/marketPhaseEventCapture';
import type { MarketPhaseEvent } from '../../services/marketPhases';
import { CustomSelect } from '../common/CustomSelect';
import { SettingsStyleToggle } from '../ui/SettingsStyleToggle';

type EventDirection = 'up' | 'down' | 'neutral';

const ACTION_ORDER: Record<string, number> = {
  'range_breakout_up:body': 0,
  'range_breakout_up:wick': 1,
  'wick_sweep_high:wick': 2,
  'range_breakout_down:body': 0,
  'range_breakout_down:wick': 1,
  'wick_sweep_low:wick': 2,
  'range_reentry:unknown': 0,
};

const NONE_VALUE = '';

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
  /** Sélection : primaire et/ou réintégration (max 2) ; « Aucun » / radio Non annule. */
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

  const { upActions, downActions, reentryAction } = useMemo(() => {
    const up: MarketPhaseEventAction[] = [];
    const down: MarketPhaseEventAction[] = [];
    let reentry: MarketPhaseEventAction | undefined;
    for (const action of MARKET_PHASE_EVENT_ACTIONS) {
      if (action.code === 'range_reentry') {
        reentry = action;
        continue;
      }
      if (action.direction === 'up') up.push(action);
      else if (action.direction === 'down') down.push(action);
    }
    up.sort((a, b) => actionSortKey(a) - actionSortKey(b));
    down.sort((a, b) => actionSortKey(a) - actionSortKey(b));
    return { upActions: up, downActions: down, reentryAction: reentry };
  }, []);

  const activeEvents = useMemo(() => activeSlotEvents(events), [events]);
  const primaryEvent = useMemo(
    () => activeEvents.find((ev) => !isRangeReentryEvent(ev)),
    [activeEvents],
  );
  const hasReentry = useMemo(
    () => activeEvents.some((ev) => isRangeReentryEvent(ev)),
    [activeEvents],
  );

  const selectedUpKey = useMemo(() => {
    if (!primaryEvent) return NONE_VALUE;
    const match = upActions.find((action) => eventMatchesAction(primaryEvent, action));
    return match ? marketPhaseEventActionKey(match) : NONE_VALUE;
  }, [primaryEvent, upActions]);

  const selectedDownKey = useMemo(() => {
    if (!primaryEvent) return NONE_VALUE;
    const match = downActions.find((action) => eventMatchesAction(primaryEvent, action));
    return match ? marketPhaseEventActionKey(match) : NONE_VALUE;
  }, [primaryEvent, downActions]);

  const emitToggle = (action: MarketPhaseEventAction) => {
    onToggle(action, mode === 'replay' ? occurredAt : undefined);
  };

  const handlePrimaryCategoryChange = (
    categoryActions: MarketPhaseEventAction[],
    nextKey: string,
    currentKey: string,
  ) => {
    if (nextKey === NONE_VALUE) {
      if (!currentKey) return;
      const current = getMarketPhaseEventActionByKey(currentKey);
      if (current) emitToggle(current);
      return;
    }
    if (nextKey === currentKey) return;
    const next = getMarketPhaseEventActionByKey(nextKey);
    if (!next || !categoryActions.some((a) => marketPhaseEventActionKey(a) === nextKey)) return;
    emitToggle(next);
  };

  const handleReentryChange = (wantReentry: boolean) => {
    if (!reentryAction) return;
    if (wantReentry === hasReentry) return;
    emitToggle(reentryAction);
  };

  const upOptions = useMemo(
    () => [
      { value: NONE_VALUE, label: t('events.none', { defaultValue: 'Aucun' }) },
      ...upActions.map((action) => ({
        value: marketPhaseEventActionKey(action),
        label: formatMarketPhaseEventActionLabel(t, action),
      })),
    ],
    [t, upActions],
  );

  const downOptions = useMemo(
    () => [
      { value: NONE_VALUE, label: t('events.none', { defaultValue: 'Aucun' }) },
      ...downActions.map((action) => ({
        value: marketPhaseEventActionKey(action),
        label: formatMarketPhaseEventActionLabel(t, action),
      })),
    ],
    [t, downActions],
  );

  return (
    <div className={`w-full font-sans ${className}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="min-w-0 flex-1 basis-0">
          <CustomSelect
            value={selectedUpKey}
            onChange={(value) =>
              handlePrimaryCategoryChange(upActions, String(value ?? NONE_VALUE), selectedUpKey)
            }
            options={upOptions}
            variant="compact"
            className="!max-w-none w-full"
            placeholder={t('events.categoryUp', { defaultValue: 'Hausse' })}
          />
        </div>
        <div className="min-w-0 flex-1 basis-0">
          <CustomSelect
            value={selectedDownKey}
            onChange={(value) =>
              handlePrimaryCategoryChange(downActions, String(value ?? NONE_VALUE), selectedDownKey)
            }
            options={downOptions}
            variant="compact"
            className="!max-w-none w-full"
            placeholder={t('events.categoryDown', { defaultValue: 'Baisse' })}
          />
        </div>
        <div className="inline-flex h-10 w-[7.5rem] shrink-0 items-center justify-center">
          <div className="-ml-2">
            <SettingsStyleToggle
              pressed={hasReentry}
              onPressedChange={handleReentryChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
