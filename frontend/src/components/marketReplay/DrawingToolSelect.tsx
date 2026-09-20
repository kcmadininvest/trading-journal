import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  LINE_TOOLS,
  SHAPE_TOOLS,
  type DrawingTool,
} from '../../utils/replayDrawings';

export type DrawingScope = 'pane' | 'all';

interface DrawingToolSelectProps {
  armedTool: DrawingTool | null;
  drawingCount: number;
  scope: DrawingScope;
  onScopeChange: (scope: DrawingScope) => void;
  onArmTool: (tool: DrawingTool | null) => void;
  onClearAll: () => void;
  disabled?: boolean;
  /** Outil Position Long/Short (hors DrawingTool — branché DraftTrade). */
  armedPositionSide?: 'LONG' | 'SHORT' | null;
  onArmPositionSide?: (side: 'LONG' | 'SHORT' | null) => void;
}

export const DrawingToolSelect: React.FC<DrawingToolSelectProps> = ({
  armedTool,
  drawingCount,
  scope,
  onScopeChange,
  onArmTool,
  onClearAll,
  disabled = false,
  armedPositionSide = null,
  onArmPositionSide,
}) => {
  const { t } = useTranslation('marketReplay');
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 260,
    maxHeight: 360,
    placement: 'bottom' as 'bottom' | 'top',
  });

  const toggleDropdown = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportMargin = 16;
      const width = 260;
      const left = Math.max(
        viewportMargin,
        Math.min(rect.left, window.innerWidth - width - viewportMargin),
      );
      const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
      const spaceAbove = rect.top - viewportMargin;
      const minHeight = 260;
      let placement: 'bottom' | 'top' = 'bottom';
      let maxHeight = Math.max(minHeight, spaceBelow);
      let top = rect.bottom + 4;
      if (spaceBelow < minHeight && spaceAbove > spaceBelow) {
        placement = 'top';
        maxHeight = Math.max(minHeight, spaceAbove);
        top = rect.top - 4;
      }
      setDropdownPosition({ top, left, width, maxHeight, placement });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toolLabel = (tool: DrawingTool) => t(`drawingTool_${tool}`);

  const renderToolButton = (tool: DrawingTool) => {
    const active = armedTool === tool;
    return (
      <button
        key={tool}
        type="button"
        className={`flex w-full items-center rounded px-1.5 py-1.5 text-left font-medium ${
          active
            ? 'bg-blue-600 text-white'
            : 'text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700'
        }`}
        onClick={() => {
          onArmTool(active ? null : tool);
          onArmPositionSide?.(null);
          setOpen(false);
        }}
      >
        {toolLabel(tool)}
      </button>
    );
  };

  const scopeBtnClass = (active: boolean) =>
    `h-7 flex-1 rounded px-1.5 text-[10px] font-semibold leading-tight ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
    }`;

  const menu = open && (
    <div
      ref={menuRef}
      className="fixed z-[9999] overflow-y-auto rounded-md border border-gray-200 bg-white p-2 text-[11px] shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        maxHeight: `${dropdownPosition.maxHeight}px`,
        ...(dropdownPosition.placement === 'top' ? { transform: 'translateY(-100%)' } : {}),
      }}
    >
      <p className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('drawingScopeLabel')}
      </p>
      <div className="mb-2 flex gap-1 px-0.5" role="group" aria-label={t('drawingScopeLabel')}>
        <button
          type="button"
          className={scopeBtnClass(scope === 'pane')}
          aria-pressed={scope === 'pane'}
          onClick={() => onScopeChange('pane')}
        >
          {t('drawingScopePane')}
        </button>
        <button
          type="button"
          className={scopeBtnClass(scope === 'all')}
          aria-pressed={scope === 'all'}
          onClick={() => onScopeChange('all')}
        >
          {t('drawingScopeAll')}
        </button>
      </div>

      <div className="border-t border-gray-200 pt-1.5 dark:border-gray-700">
        <button
          type="button"
          className={`mb-1 flex w-full items-center rounded px-1.5 py-1.5 text-left font-medium ${
            armedTool == null && armedPositionSide == null
              ? 'bg-blue-600 text-white'
              : 'text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={() => {
          onArmTool(null);
          onArmPositionSide?.(null);
          setOpen(false);
        }}
      >
        {t('drawingSelect')}
      </button>
      </div>

      {onArmPositionSide ? (
        <>
          <p className="px-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('drawingSectionPosition')}
          </p>
          <div className="pb-1">
            {(['LONG', 'SHORT'] as const).map((side) => {
              const active = armedPositionSide === side;
              return (
                <button
                  key={side}
                  type="button"
                  className={`flex w-full items-center rounded px-1.5 py-1.5 text-left font-medium ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => {
                    onArmTool(null);
                    onArmPositionSide(active ? null : side);
                    setOpen(false);
                  }}
                >
                  {side === 'LONG'
                    ? t('drawingTool_longPosition')
                    : t('drawingTool_shortPosition')}
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700" />
        </>
      ) : null}

      <p className="px-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('drawingSectionLines')}
      </p>
      <div className="pb-1">{LINE_TOOLS.map(renderToolButton)}</div>

      <div className="border-t border-gray-200 dark:border-gray-700" />
      <p className="px-1.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('drawingSectionShapes')}
      </p>
      <div className="pb-1">{SHAPE_TOOLS.map(renderToolButton)}</div>

      <div className="border-t border-gray-200 pt-1.5 dark:border-gray-700">
        <button
          type="button"
          disabled={drawingCount === 0}
          className="flex w-full items-center rounded px-1.5 py-1.5 text-left font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
          onClick={() => {
            onClearAll();
            setOpen(false);
          }}
        >
          {t('drawingClearAll')}
        </button>
      </div>
    </div>
  );

  const label =
    drawingCount > 0 ? `${t('drawings')} (${drawingCount})` : t('drawings');

  return (
    <>
      <div ref={dropdownRef} className="relative min-w-0">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={toggleDropdown}
          aria-expanded={open}
          aria-label={t('drawingsHint')}
          className={`inline-flex h-6 min-w-[5.5rem] items-center justify-between gap-1.5 rounded border px-2 text-[11px] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
            armedTool || armedPositionSide
              ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200'
              : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700'
          }`}
        >
          <span className="whitespace-nowrap text-gray-900 dark:text-gray-100">
            {armedTool ? toolLabel(armedTool) : label}
          </span>
          <svg
            className={`h-3 w-3 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${open ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && typeof document !== 'undefined' && createPortal(menu, document.body)}
    </>
  );
};
