import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import { replayPrimaryButtonClass, replaySecondaryButtonClass } from '../replay/replayStyles';
import { useMarketPhaseCapture, nowTimeInTz } from '../../hooks/useMarketPhaseCapture';
import { usePreferences } from '../../hooks/usePreferences';
import { MarketPhaseEventButtons, MarketPhaseRecordedEvents } from './MarketPhaseEventButtons';
import { formatSessionClockLabel } from '../../utils/dateFormat';

export interface MarketPhaseCapturePanelProps {
  tradingAccountId?: number;
  sessionDate?: string;
  instrumentKey?: string;
  source?: 'live' | 'replay';
  tradingSessionId?: number;
  compact?: boolean;
  onSelectTimestamp?: (time: string) => void;
  className?: string;
}

export const MarketPhaseCapturePanel: React.FC<MarketPhaseCapturePanelProps> = ({
  tradingAccountId,
  sessionDate,
  instrumentKey,
  source = 'live',
  tradingSessionId,
  compact = true,
  onSelectTimestamp,
  className = '',
}) => {
  const { t } = useTranslation('marketPhases');
  const { preferences } = usePreferences();
  const [expanded, setExpanded] = useState(!compact);
  const capture = useMarketPhaseCapture({
    tradingAccountId,
    sessionDate,
    instrumentKey,
    source,
    tradingSessionId,
  });

  const freeBlocks = useMemo(() => capture.blocks, [capture.blocks]);

  const instrumentOptions = useMemo(
    () => capture.instruments.map((i) => ({ value: i.key, label: i.label })),
    [capture.instruments],
  );

  const phaseOptions = useMemo(
    () => capture.phases.map((p) => ({ value: p.code, label: p.label })),
    [capture.phases],
  );

  const contextOptions = useMemo(
    () =>
      Object.entries(t('contextOptions', { returnObjects: true }) as Record<string, string>).map(
        ([value, label]) => ({ value, label }),
      ),
    [t],
  );

  const liveClock = useMemo(() => nowTimeInTz(preferences.timezone), [preferences.timezone]);

  if (!tradingAccountId) return null;

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('captureTitle')}</h3>
        {compact && (
          <button
            type="button"
            className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '−' : '+'}
          </button>
        )}
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t('instrument')}
          </label>
          <CustomSelect
            value={capture.instrumentKey}
            onChange={(value) => capture.setInstrumentKey(String(value ?? 'nasdaq'))}
            options={instrumentOptions}
            variant="compact"
          />
        </div>
        <div className="min-w-[12rem]">
          <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t('selectPhase')}
          </label>
          <CustomSelect
            value={capture.selectedPhase}
            onChange={(value) => capture.setSelectedPhase(String(value ?? ''))}
            options={phaseOptions}
            variant="compact"
            className="!max-w-none w-full"
          />
        </div>
        <div className="min-w-[14rem]">
          <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
            {t('context')}
          </label>
          <CustomSelect
            value={capture.precedingContext}
            onChange={(value) => capture.setPrecedingContext(String(value ?? 'none'))}
            options={contextOptions}
            variant="compact"
            className="!max-w-none w-full"
          />
        </div>
      </div>

      {(expanded || !compact) && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {!capture.openBlockStart ? (
              <button
                type="button"
                className={`${replayPrimaryButtonClass} !h-8 text-xs`}
                onClick={capture.handleStartBlock}
              >
                {t('startBlock')}
              </button>
            ) : (
              <button
                type="button"
                className={`${replaySecondaryButtonClass} !h-8 text-xs`}
                onClick={capture.handleCloseBlock}
              >
                {t('closeBlock')} ({formatSessionClockLabel(capture.openBlockStart)})
              </button>
            )}
          </div>

          <MarketPhaseEventButtons
            mode={source}
            occurredAt={liveClock}
            onRecord={(action, at) =>
              capture.handleQuickEvent(
                action.code,
                action.direction,
                action.candlePart,
                action.outcome,
                source === 'replay' ? at : undefined,
              )
            }
            className="mb-3"
          />

          <div className="max-h-48 space-y-2 overflow-y-auto text-xs">
            {freeBlocks.length === 0 && capture.allEvents.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400">{t('noData')}</p>
            )}
            {freeBlocks.map((block) => (
              <div key={`${block.range_start}-${block.id ?? 'new'}`} className="border-l-2 border-violet-400 pl-2">
                <button
                  type="button"
                  className="font-medium text-gray-800 dark:text-gray-200"
                  onClick={() => onSelectTimestamp?.(block.range_start)}
                >
                  {formatSessionClockLabel(block.range_start)}
                  {block.range_end ? ` – ${formatSessionClockLabel(block.range_end)}` : ' …'}
                  {' '}{block.phase_label || block.phase_code}
                </button>
                {(block.events || []).length > 0 && (
                  <MarketPhaseRecordedEvents
                    variant="inline"
                    events={block.events || []}
                    selectedEventKey={capture.selectedEventKey}
                    onSelectEvent={capture.handleSelectEvent}
                    onRemoveEvent={capture.handleRemoveEvent}
                    onSelectTimestamp={onSelectTimestamp}
                    className="ml-2 mt-1"
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {capture.saveState === 'saving' && t('saving')}
          {capture.saveState === 'saved' && t('saved')}
        </span>
        <button
          type="button"
          className="text-sky-600 hover:underline dark:text-sky-400"
          onClick={() => {
            window.location.hash = 'analytics';
            localStorage.setItem('analytics-active-tab', 'marketPhases');
          }}
        >
          {t('viewStats')}
        </button>
      </div>
    </div>
  );
};

export default MarketPhaseCapturePanel;
