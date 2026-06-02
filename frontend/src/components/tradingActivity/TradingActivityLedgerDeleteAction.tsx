import React from 'react';
import { Tooltip } from '../ui';

export function TradingActivityLedgerDeleteAction({
  deleteLabel,
  onRequestDelete,
  compact,
}: {
  deleteLabel: string;
  onRequestDelete: () => void;
  compact: boolean;
}) {
  const pad = compact ? 'p-1.5' : 'p-2';
  const icon = compact ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <Tooltip content={deleteLabel} position="top">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRequestDelete();
        }}
        aria-label={deleteLabel}
        className={`${pad} rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300`}
      >
        <svg className={icon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1V5a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 001 1m-7 0h8"
          />
        </svg>
      </button>
    </Tooltip>
  );
}
