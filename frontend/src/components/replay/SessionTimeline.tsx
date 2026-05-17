import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionEventItem } from '../../services/sessionReplay';
import { formatTime } from '../../utils/dateFormat';
import { NumberFormatType } from '../../utils/numberFormat';
import { getEventDetailText } from './eventDetail';
import { getReplayPnlBgClass, replaySecondaryButtonClass } from './replayStyles';
import { TIMELINE_FILTER_KEYS, type TimelineFilterKey } from './timelineFilters';

interface SessionTimelineProps {
  events: SessionEventItem[];
  visibleIndices: number[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  activeFilters: ReadonlySet<TimelineFilterKey>;
  onToggleFilter: (key: TimelineFilterKey) => void;
  playing?: boolean;
  timezone?: string;
  language?: string;
  numberFormat?: NumberFormatType;
}

const EVENT_DOT_COLORS: Record<string, string> = {
  order_created: 'bg-blue-500',
  order_updated: 'bg-blue-400',
  fill: 'bg-amber-500',
  position_open: 'bg-green-500',
  position_close: 'bg-red-500',
  pnl_tick: 'bg-blue-600 dark:bg-blue-400',
};

const filterChipActiveClass =
  'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500';
const filterChipInactiveClass =
  'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700';

function eventPnlHint(evt: SessionEventItem): number {
  if (evt.event_type === 'position_close') {
    const raw = evt.payload?.pnl;
    if (raw != null) {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
  }
  if (evt.event_type === 'position_open') return 0.001;
  return 0;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  events,
  visibleIndices,
  currentIndex,
  onSelectIndex,
  activeFilters,
  onToggleFilter,
  playing = false,
  timezone = 'Europe/Paris',
  language = 'fr',
  numberFormat = 'comma',
}) => {
  const { t } = useTranslation('replay');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const active = activeItemRef.current;
    if (!container || !active) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const padding = 8;
    const above = activeRect.top < containerRect.top + padding;
    const below = activeRect.bottom > containerRect.bottom - padding;

    if (above || below) {
      active.scrollIntoView({ block: 'nearest', behavior: playing ? 'auto' : 'smooth' });
    }
  }, [currentIndex, visibleIndices.length, playing]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 sr-only sm:not-sr-only">
          {t('timelineFiltersLabel')}
        </span>
        {TIMELINE_FILTER_KEYS.map((key) => {
          const active = activeFilters.has(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleFilter(key)}
              className={`${replaySecondaryButtonClass} !h-8 !px-3 text-xs border ${
                active ? filterChipActiveClass : filterChipInactiveClass
              }`}
            >
              {t(`timelineFilters.${key}`)}
            </button>
          );
        })}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          {t('noEvents')}
        </p>
      ) : visibleIndices.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          {t('noEventsFiltered')}
        </p>
      ) : (
        <div
          ref={scrollContainerRef}
          className="relative border-l-2 border-gray-200 dark:border-gray-600 ml-3 pl-4 space-y-2 max-h-80 overflow-y-auto scroll-smooth"
        >
          {visibleIndices.map((eventIndex) => {
            const evt = events[eventIndex];
            const isActive = eventIndex === currentIndex;
            const dotColor = EVENT_DOT_COLORS[evt.event_type] || 'bg-gray-400';
            const pnlHint = eventPnlHint(evt);
            const detail = getEventDetailText(evt, t, numberFormat);
            return (
              <button
                key={evt.id}
                ref={isActive ? (el) => { activeItemRef.current = el; } : undefined}
                type="button"
                onClick={() => onSelectIndex(eventIndex)}
                className={`relative w-full text-left rounded-md px-3 py-2 text-sm transition border border-transparent ${getReplayPnlBgClass(
                  pnlHint,
                  isActive,
                )}`}
              >
                <span
                  className={`absolute -left-[1.35rem] top-3 w-3 h-3 rounded-full ${dotColor} ring-2 ring-white dark:ring-gray-800`}
                />
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(evt.occurred_at, timezone, language as 'fr')}
                </span>
                <div className="ml-2 inline-block align-top min-w-0">
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {t(`eventTypes.${evt.event_type}`, { defaultValue: evt.event_type })}
                  </span>
                  {detail && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug break-words">
                      {detail}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
