import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DRAWING_COLOR_PALETTE,
  DRAWING_LINE_WIDTHS,
  type DrawingStyle,
} from '../../utils/replayDrawings';

interface DrawingStyleBarProps {
  style: DrawingStyle;
  anchor: { left: number; top: number };
  isDark: boolean;
  onChange: (next: DrawingStyle) => void;
  onDelete: () => void;
}

export const DrawingStyleBar: React.FC<DrawingStyleBarProps> = ({
  style,
  anchor,
  isDark,
  onChange,
  onDelete,
}) => {
  const { t } = useTranslation('marketReplay');
  const palette = DRAWING_COLOR_PALETTE.filter((c) => {
    if (c === '#FFFFFF') return !isDark;
    if (c === '#131722') return isDark;
    return true;
  });

  return (
    <div
      className="absolute z-30 flex flex-wrap items-center gap-1.5 rounded-md border border-gray-200 bg-white/95 px-1.5 py-1 shadow-md dark:border-gray-600 dark:bg-gray-800/95"
      style={{
        left: Math.max(4, anchor.left),
        top: Math.max(4, anchor.top),
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1" role="group" aria-label={t('drawingColor')}>
        {palette.map((color) => {
          const active = style.color.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              className={`h-4 w-4 rounded-full border ${
                active
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : 'border-gray-300 dark:border-gray-500'
              }`}
              style={{ backgroundColor: color }}
              aria-label={color}
              aria-pressed={active}
              onClick={() => onChange({ ...style, color })}
            />
          );
        })}
        <label className="relative h-4 w-4 cursor-pointer overflow-hidden rounded-full border border-dashed border-gray-400 dark:border-gray-500">
          <span className="sr-only">{t('drawingCustomColor')}</span>
          <input
            type="color"
            value={style.color.startsWith('#') ? style.color.slice(0, 7) : '#2962FF'}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => onChange({ ...style, color: e.target.value })}
          />
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            }}
            aria-hidden
          />
        </label>
      </div>

      <span className="mx-0.5 h-3 w-px bg-gray-200 dark:bg-gray-600" aria-hidden />

      <div className="flex items-center gap-0.5" role="group" aria-label={t('drawingLineWidth')}>
        {DRAWING_LINE_WIDTHS.map((width) => {
          const active = Math.round(style.lineWidth) === width;
          return (
            <button
              key={width}
              type="button"
              className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded px-1 text-[10px] font-semibold tabular-nums ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-pressed={active}
              onClick={() => onChange({ ...style, lineWidth: width })}
            >
              {width}
            </button>
          );
        })}
      </div>

      <span className="mx-0.5 h-3 w-px bg-gray-200 dark:bg-gray-600" aria-hidden />

      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded text-sm leading-none text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        aria-label={t('drawingDelete')}
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  );
};
