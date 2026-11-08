import React from 'react';
import type { LedgerSortDirection } from '../../utils/tradingActivityLedgerSort';

type Props = {
  label: string;
  field: string;
  activeField: string;
  direction: LedgerSortDirection;
  onSort: (field: string) => void;
  className?: string;
};

/**
 * En-tête de colonne triable (desktop ledger). Mobile : non utilisé.
 */
export function TradingActivitySortableTh({
  label,
  field,
  activeField,
  direction,
  onSort,
  className = '',
}: Props): React.ReactElement {
  const active = activeField === field;
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-3 py-2 ${className}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSort(field);
        }}
        className="inline-flex items-center gap-1 rounded text-left font-medium text-inherit hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-gray-100"
      >
        <span>{label}</span>
        {active && (
          <svg
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${direction === 'desc' ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
      </button>
    </th>
  );
}
