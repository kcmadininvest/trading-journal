import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  SkipToEndIcon,
  SkipToStartIcon,
  StepBackIcon,
  StepForwardIcon,
} from '../replay/replayPlaybackIcons';
import {
  replayGroupInnerButtonClass,
  replayGroupShellClass,
  replayPrimaryButtonClass,
  replaySecondaryButtonClass,
} from '../replay/replayStyles';
import { formatDateTimeShort, type DateFormatType } from '../../utils/dateFormat';
import { usePreferences } from '../../hooks/usePreferences';

const SPEEDS = [1, 2, 5, 10, 20] as const;

interface ReplayControlsProps {
  playing: boolean;
  speed: number;
  replayTimestamp: number;
  startTimestamp: number;
  endTimestamp: number;
  disabled?: boolean;
  /** Barre compacte à côté des filtres (boutons + horloge + timeline). */
  compact?: boolean;
  onPlayPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onGoStart: () => void;
  onGoEnd: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (timestamp: number) => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  playing,
  speed,
  replayTimestamp,
  startTimestamp,
  endTimestamp,
  disabled = false,
  compact = false,
  onPlayPause,
  onStepBack,
  onStepForward,
  onGoStart,
  onGoEnd,
  onReset,
  onSpeedChange,
  onSeek,
}) => {
  const { t } = useTranslation('marketReplay');
  const { preferences } = usePreferences();
  const iconButtonClass = compact
    ? '!h-9 !w-9 !min-w-[2.25rem] !px-0'
    : '!w-10 !min-w-[2.5rem] !px-0';

  const clockLabel =
    replayTimestamp > 0
      ? formatDateTimeShort(
          new Date(replayTimestamp * 1000).toISOString(),
          preferences.date_format as DateFormatType,
          preferences.timezone,
        )
      : '—';

  const transport = (
    <div
      className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${
        compact ? 'justify-end' : 'gap-2 sm:gap-3'
      }`}
    >
      <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/60 p-1">
        <button
          type="button"
          className={`${replaySecondaryButtonClass} ${iconButtonClass} !h-9 !shadow-none`}
          disabled={disabled}
          onClick={onGoStart}
          title={t('goStart')}
          aria-label={t('goStart')}
        >
          <SkipToStartIcon />
        </button>
        <button
          type="button"
          className={`${replaySecondaryButtonClass} ${iconButtonClass} !h-9 !shadow-none`}
          disabled={disabled}
          onClick={onStepBack}
          title={t('stepBack')}
          aria-label={t('stepBack')}
        >
          <StepBackIcon />
        </button>
        <button
          type="button"
          className={`${replayPrimaryButtonClass} ${iconButtonClass} !h-9`}
          disabled={disabled}
          onClick={onPlayPause}
          title={playing ? t('pause') : t('play')}
          aria-label={playing ? t('pause') : t('play')}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className={`${replaySecondaryButtonClass} ${iconButtonClass} !h-9 !shadow-none`}
          disabled={disabled}
          onClick={onStepForward}
          title={t('stepForward')}
          aria-label={t('stepForward')}
        >
          <StepForwardIcon />
        </button>
        <button
          type="button"
          className={`${replaySecondaryButtonClass} ${iconButtonClass} !h-9 !shadow-none`}
          disabled={disabled}
          onClick={onGoEnd}
          title={t('goEnd')}
          aria-label={t('goEnd')}
        >
          <SkipToEndIcon />
        </button>
        <button
          type="button"
          className={`${replaySecondaryButtonClass} ${iconButtonClass} !h-9 !shadow-none`}
          disabled={disabled}
          onClick={onReset}
          title={t('reset')}
          aria-label={t('reset')}
        >
          <ReplayIcon />
        </button>
      </div>

      <div className={replayGroupShellClass} role="group">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onSpeedChange(s)}
            className={`${replaySecondaryButtonClass} ${replayGroupInnerButtonClass} w-10 shrink-0 !px-0 tabular-nums ${
              speed === s
                ? '!bg-blue-600 !text-white hover:!bg-blue-700 dark:!bg-blue-500 dark:hover:!bg-blue-600'
                : '!bg-transparent text-gray-700 dark:text-gray-300 hover:!bg-white/90 dark:hover:!bg-gray-700/80'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <span
        className={`text-xs sm:text-sm text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap px-1 ${
          replayTimestamp > 0 ? '' : 'hidden'
        }`}
      >
        {clockLabel}
      </span>
    </div>
  );

  const timeline = (
    <input
      type="range"
      min={startTimestamp}
      max={Math.max(endTimestamp, startTimestamp)}
      step={1}
      value={Math.min(Math.max(replayTimestamp, startTimestamp), endTimestamp || startTimestamp)}
      disabled={disabled || endTimestamp <= startTimestamp}
      onChange={(e) => onSeek(Number(e.target.value))}
      className="w-full h-1.5 accent-blue-600 dark:accent-blue-500 cursor-pointer disabled:opacity-40"
      aria-label={t('timeline')}
    />
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-2 min-w-0 sm:items-end">
        {transport}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {transport}
      {timeline}
    </div>
  );
};
