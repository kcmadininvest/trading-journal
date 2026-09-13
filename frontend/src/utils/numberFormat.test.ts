import { describe, expect, it } from 'vitest';
import { parseLocalizedNumber } from './numberFormat';
import {
  previewResultPoints,
  previewResultR,
  statusFromPoints,
} from '../components/backtestJournal/datetimeLocal';

describe('parseLocalizedNumber', () => {
  it('parses comma format', () => {
    expect(parseLocalizedNumber('1 234,50', 'comma')).toBeCloseTo(1234.5);
  });

  it('parses point format', () => {
    expect(parseLocalizedNumber('1,234.50', 'point')).toBeCloseTo(1234.5);
  });

  it('keeps canonical API decimals in comma mode', () => {
    expect(parseLocalizedNumber('2.0000', 'comma')).toBeCloseTo(2);
  });

  it('returns null for empty', () => {
    expect(parseLocalizedNumber('', 'comma')).toBeNull();
  });
});

describe('previewResultR', () => {
  it('computes long and short R', () => {
    expect(previewResultR('LONG', 100, 90, 120)).toBeCloseTo(2);
    expect(previewResultR('SHORT', 100, 110, 80)).toBeCloseTo(2);
  });
});

describe('previewResultPoints', () => {
  it('computes signed points', () => {
    expect(previewResultPoints('LONG', 100, 120)).toBeCloseTo(20);
    expect(previewResultPoints('SHORT', 100, 80)).toBeCloseTo(20);
    expect(previewResultPoints('LONG', 100, 90)).toBeCloseTo(-10);
  });
});

describe('statusFromPoints', () => {
  it('maps points to result status', () => {
    expect(statusFromPoints(2, true)).toBe('WIN');
    expect(statusFromPoints(-1, true)).toBe('LOSS');
    expect(statusFromPoints(0, true)).toBe('BREAKEVEN');
    expect(statusFromPoints(null, true)).toBe('OPEN');
    expect(statusFromPoints(2, false)).toBe('NOT_TAKEN');
  });
});
