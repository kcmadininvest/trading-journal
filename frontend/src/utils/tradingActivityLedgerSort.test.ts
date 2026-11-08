import { describe, expect, it } from 'vitest';
import {
  initialDirectionForField,
  nextSortEntry,
  resolveTabSort,
  toOrderingParam,
} from './tradingActivityLedgerSort';

describe('tradingActivityLedgerSort', () => {
  it('defaults missing tab to date desc', () => {
    expect(resolveTabSort({}, 'debit')).toEqual({ field: 'date', direction: 'desc' });
  });

  it('toggles direction on same field', () => {
    expect(nextSortEntry({ field: 'date', direction: 'desc' }, 'date')).toEqual({
      field: 'date',
      direction: 'asc',
    });
  });

  it('uses type-aware first direction for a new field', () => {
    expect(initialDirectionForField('total')).toBe('desc');
    expect(initialDirectionForField('label')).toBe('asc');
    expect(nextSortEntry({ field: 'date', direction: 'desc' }, 'label')).toEqual({
      field: 'label',
      direction: 'asc',
    });
  });

  it('builds ordering query param', () => {
    expect(toOrderingParam({ field: 'date', direction: 'desc' })).toBe('-date');
    expect(toOrderingParam({ field: 'total', direction: 'asc' })).toBe('total');
  });
});
