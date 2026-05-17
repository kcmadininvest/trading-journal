import React from 'react';
import { useTranslation } from 'react-i18next';
import { replayPrimaryButtonClass } from './replayStyles';

interface PlaybackControlsProps {
  playing: boolean;
  speed: number;
  currentIndex: number;
  maxIndex: number;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (index: number) => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  playing,
  speed,
  currentIndex,
  maxIndex,
  onPlayPause,
  onSpeedChange,
  onSeek,
}) => {
  const { t } = useTranslation('replay');

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          type="button"
          onClick={onPlayPause}
          disabled={maxIndex <= 0}
          className={replayPrimaryButtonClass}
        >
          {playing ? t('pause') : t('play')}
        </button>
        <div className="inline-flex rounded-md shadow-sm" role="group">
          {[1, 2, 4].map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              className={`px-3 py-2 text-xs sm:text-sm font-medium border ${
                i === 0 ? 'rounded-l-md' : ''
              } ${i === 2 ? 'rounded-r-md border-t border-r border-b' : 'border-t border-b border-r'} ${
                speed === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          {currentIndex + 1} / {Math.max(maxIndex + 1, 1)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(maxIndex, 0)}
        value={currentIndex}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full accent-blue-600 dark:accent-blue-500"
        disabled={maxIndex <= 0}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('shortcutsHint')}</p>
    </div>
  );
};
