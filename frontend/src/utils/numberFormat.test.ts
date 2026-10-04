import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sanitizeNumericInput } from '../components/backtestJournal/ObservationGrid';
import { normalizeDecimalForApi, parseUserDecimal } from './normalizeDecimalForApi';
import {
  cleanNumberInput,
  formatNumber,
  getNumberFormatExample,
  parseLocalizedNumber,
  type NumberFormatType,
} from './numberFormat';
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

/** Ancien `parseLocalizedNumber`, figé avant la règle de regroupement du format point. */
function legacyParseLocalizedNumber(
  value: string,
  numberFormat: NumberFormatType,
): number | null {
  let normalized = value.trim();
  if (!normalized) return null;
  if (/^-?\d+\.\d+$/.test(normalized) && !normalized.includes(',')) {
    const canonical = Number(normalized);
    return Number.isFinite(canonical) ? canonical : null;
  }
  if (numberFormat === 'comma') {
    normalized = normalized.replace(/\s/g, '');
    if (normalized.includes(',')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    }
  } else {
    normalized = normalized.replace(/,/g, '');
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

/** Ancien `NumberInput.parseToStandard`, sans min/max. */
function legacyCleanNumberInput(displayVal: string, numberFormat: NumberFormatType): string {
  if (!displayVal) return '';
  let cleaned = displayVal.trim();
  if (!cleaned) return '';
  if (numberFormat === 'comma') {
    cleaned = cleaned.replace(/\s/g, '');
    cleaned = cleaned.replace(/,/g, '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return '';
  return String(num);
}

/** Ancien `sanitizeNumericInput`. */
function legacySanitize(raw: string, numberFormat: NumberFormatType): string {
  const decimal = numberFormat === 'comma' ? ',' : '.';
  const stripped = raw.replace(numberFormat === 'comma' ? /[^0-9,]/g : /[^0-9.]/g, '');
  const firstSep = stripped.indexOf(decimal);
  if (firstSep === -1) return stripped;
  return stripped.slice(0, firstSep + 1) + stripped.slice(firstSep + 1).replaceAll(decimal, '');
}

type PointKind = 'none' | 'invalid-comma' | 'comma-after-dot';

function pointChangeKind(raw: string): PointKind {
  const trimmed = raw.trim();
  if (/^-?\d+\.\d+$/.test(trimmed) && !trimmed.includes(',')) return 'none';
  const match = /^([+-]?[\d.,]+)/.exec(trimmed);
  if (!match || !match[1].includes(',')) return 'none';
  const prefix = match[1];
  if (prefix.includes('.')) {
    return prefix.lastIndexOf(',') > prefix.lastIndexOf('.') ? 'comma-after-dot' : 'none';
  }
  if (/^[+-]?\d{1,3}(,\d{3})+$/.test(prefix) && !/^[+-]?0,\d+$/.test(prefix)) return 'none';
  if (prefix.split(',').length - 1 === 1) return 'invalid-comma';
  return 'none';
}

function rewritePointPrefix(prefix: string): string {
  if (!prefix.includes(',')) return prefix;
  if (prefix.includes('.')) {
    if (prefix.lastIndexOf('.') > prefix.lastIndexOf(',')) return prefix.replace(/,/g, '');
    const withoutDots = prefix.replace(/\./g, '');
    const decimalAt = withoutDots.lastIndexOf(',');
    return withoutDots.slice(0, decimalAt).replace(/,/g, '') + '.' + withoutDots.slice(decimalAt + 1);
  }
  if (/^[+-]?\d{1,3}(,\d{3})+$/.test(prefix) && !/^[+-]?0,\d+$/.test(prefix)) {
    return prefix.replace(/,/g, '');
  }
  if (prefix.split(',').length - 1 === 1) return prefix.replace(',', '.');
  return prefix.replace(/,/g, '');
}

function specNormalizedPoint(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^-?\d+\.\d+$/.test(trimmed) && !trimmed.includes(',')) return trimmed;
  const match = /^([+-]?[\d.,]+)(.*)$/s.exec(trimmed);
  if (!match) return trimmed;
  return rewritePointPrefix(match[1]) + match[2];
}

function specParsePoint(raw: string): number | null {
  const normalized = specNormalizedPoint(raw);
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function specCleanPoint(raw: string): string {
  const num = parseFloat(specNormalizedPoint(raw));
  return Number.isNaN(num) ? '' : String(num);
}

function fail(message: string): never {
  throw new Error(message);
}

function assertSameParsers(raw: string, numberFormat: NumberFormatType): void {
  const legacyParsed = legacyParseLocalizedNumber(raw, numberFormat);
  const parsed = parseLocalizedNumber(raw, numberFormat);
  const legacyClean = legacyCleanNumberInput(raw, numberFormat);
  const cleaned = cleanNumberInput(raw, numberFormat);
  const legacySanitized = legacySanitize(raw, numberFormat);
  const sanitized = sanitizeNumericInput(raw, numberFormat);
  const kind = numberFormat === 'point' ? pointChangeKind(raw) : 'none';

  if (numberFormat === 'comma' || kind === 'none') {
    if (parsed !== legacyParsed) {
      fail(`parse ${numberFormat} ${JSON.stringify(raw)}: ${parsed} !== ${legacyParsed}`);
    }
    if (cleaned !== legacyClean) {
      fail(`clean ${numberFormat} ${JSON.stringify(raw)}: ${cleaned} !== ${legacyClean}`);
    }
  } else {
    const expected = specParsePoint(raw);
    const expectedClean = specCleanPoint(raw);
    if (parsed !== expected) {
      fail(`parse point ${JSON.stringify(raw)}: ${parsed} !== spec ${expected}`);
    }
    if (cleaned !== expectedClean) {
      fail(`clean point ${JSON.stringify(raw)}: ${cleaned} !== spec ${expectedClean}`);
    }
  }

  if (numberFormat === 'comma') {
    if (sanitized !== legacySanitized) {
      fail(`sanitize comma ${JSON.stringify(raw)}: ${sanitized} !== ${legacySanitized}`);
    }
    return;
  }

  const legacySanitizedNumber = legacyParseLocalizedNumber(legacySanitized, 'point');
  const sanitizedNumber = parseLocalizedNumber(sanitized, 'point');
  if (sanitizedNumber === legacySanitizedNumber) return;
  if (pointChangeKind(sanitized) === 'none') {
    fail(`sanitize point ${JSON.stringify(raw)}: ${sanitizedNumber} !== ${legacySanitizedNumber}`);
  }
  const expectedSanitized = specParsePoint(sanitized);
  if (sanitizedNumber !== expectedSanitized) {
    fail(`sanitize point ${JSON.stringify(raw)}: ${sanitizedNumber} !== spec ${expectedSanitized}`);
  }
}

function assertRoundTrip(value: number, digits: number, numberFormat: NumberFormatType): void {
  const shown = formatNumber(value, digits, numberFormat);
  const parsed = parseLocalizedNumber(shown, numberFormat);
  if (formatNumber(parsed, digits, numberFormat) !== shown) {
    fail(`aller-retour ${numberFormat} digits=${digits} ${value} → ${shown} → ${parsed}`);
  }
}

function syntheticValues(): number[] {
  const values = new Set<number>([
    -2108.4, -12.5, -0.72, 0, 0.72, 0.125, 1, 1.5, 2, 10, 14, 15, 20,
    1234, 1234.56, 1851.6, 2000, 4500, 50000, 150000, 7789.00734372,
  ]);
  for (let price = 2000; price <= 31000; price += 250) {
    values.add(price);
    values.add(price + 0.25);
    values.add(price + 0.5);
    values.add(price + 0.75);
  }
  return [...values];
}

function expandedSamples(value: number): string[] {
  const samples = [String(value), value.toFixed(2), value.toFixed(4), `${value}€`, ` ${value} `];
  for (const numberFormat of ['comma', 'point'] as const) {
    for (const digits of [0, 2, 4]) {
      const shown = formatNumber(value, digits, numberFormat);
      if (shown === '-') continue;
      samples.push(shown);
      for (let index = 1; index < shown.length; index += 1) {
        samples.push(shown.slice(0, index));
      }
    }
  }
  return samples;
}

describe('getNumberFormatExample', () => {
  it('shows grouping and a decimal in both formats', () => {
    expect(getNumberFormatExample('point')).toBe('1,234.56');
    expect(getNumberFormatExample('comma').replace(/\s/g, ' ')).toBe('1 234,56');
    expect(getNumberFormatExample('comma')).toMatch(/1\s234,56/);
  });
});

describe('format point', () => {
  it('reads a lone comma as a decimal when grouping is invalid', () => {
    expect(parseLocalizedNumber('1,5', 'point')).toBe(1.5);
    expect(parseLocalizedNumber('1,50', 'point')).toBe(1.5);
    expect(parseLocalizedNumber('0,125', 'point')).toBe(0.125);
    expect(parseLocalizedNumber('-12,5', 'point')).toBe(-12.5);
    expect(parseLocalizedNumber('7789,0073', 'point')).toBe(7789.0073);
    expect(parseLocalizedNumber('12345,678', 'point')).toBe(12345.678);
    expect(parseLocalizedNumber('1,', 'point')).toBe(1);
    expect(cleanNumberInput('1,5', 'point')).toBe('1.5');
    expect(cleanNumberInput('1,', 'point')).toBe('1');
  });

  it('keeps valid thousands grouping and a trailing decimal point', () => {
    expect(parseLocalizedNumber('1,234', 'point')).toBe(1234);
    expect(parseLocalizedNumber('1,500', 'point')).toBe(1500);
    expect(parseLocalizedNumber('150,000', 'point')).toBe(150000);
    expect(parseLocalizedNumber('2,513.50', 'point')).toBe(2513.5);
    expect(parseLocalizedNumber('-2,108.40', 'point')).toBe(-2108.4);
    expect(parseLocalizedNumber('1,23,4', 'point')).toBe(1234);
    expect(cleanNumberInput('2,513.50', 'point')).toBe('2513.5');
    expect(cleanNumberInput('1,234', 'point')).toBe('1234');
  });

  it('treats the last separator as the decimal when both are present', () => {
    expect(parseLocalizedNumber('1.234,56', 'point')).toBe(1234.56);
    expect(cleanNumberInput('1.234,56', 'point')).toBe('1234.56');
  });

  it('keeps parseFloat suffix tolerance in NumberInput', () => {
    expect(cleanNumberInput('12€', 'point')).toBe('12');
    expect(cleanNumberInput('12 $', 'point')).toBe('12');
    expect(cleanNumberInput('12€', 'comma')).toBe('12');
    expect(parseLocalizedNumber('12€', 'point')).toBeNull();
  });
});

describe('format comma unchanged', () => {
  it('parses spaces, including the narrow no-break space, and dot thousands', () => {
    expect(parseLocalizedNumber('2 513,50', 'comma')).toBe(2513.5);
    expect(parseLocalizedNumber('2\u202f513,50', 'comma')).toBe(2513.5);
    expect(parseLocalizedNumber('1.234,56', 'comma')).toBe(1234.56);
    expect(parseLocalizedNumber('0,72', 'comma')).toBe(0.72);
    expect(parseLocalizedNumber('2.0000', 'comma')).toBe(2);
    expect(parseLocalizedNumber('2.0000', 'point')).toBe(2);
    expect(cleanNumberInput('2 513,50', 'comma')).toBe('2513.5');
    expect(cleanNumberInput('2\u202f513,50', 'comma')).toBe('2513.5');
    expect(cleanNumberInput('1.234,56', 'comma')).toBe('1.234');
  });
});

describe('normalizeDecimalForApi unchanged', () => {
  it('keeps its own point-mode comma rule', () => {
    expect(normalizeDecimalForApi('1,5', 'point')).toBe('1.5');
    expect(normalizeDecimalForApi('1,234', 'point')).toBe('1.234');
    expect(parseUserDecimal('1,234', 'point')).toBeCloseTo(1.234);
    expect(normalizeDecimalForApi('1 234,56', 'comma')).toBe('1234.56');
  });
});

describe('différentiel ancien / nouveau', () => {
  it('ne change le format point que pour les motifs visés, et jamais le format virgule', () => {
    expect(syntheticValues().length).toBeGreaterThan(100);
    for (const value of syntheticValues()) {
      for (const sample of expandedSamples(value)) {
        assertSameParsers(sample, 'comma');
        assertSameParsers(sample, 'point');
      }
      for (const numberFormat of ['comma', 'point'] as const) {
        for (const digits of [0, 2, 4]) {
          assertRoundTrip(value, digits, numberFormat);
        }
      }
    }
  });
});

const recetteCorpus = process.env.RECETTE_CORPUS;

describe.skipIf(!recetteCorpus)('recette corpus', () => {
  it('rejoue chaque montant réel sans écart hors motifs visés', () => {
    const values = JSON.parse(readFileSync(recetteCorpus!, 'utf8')) as unknown[];
    expect(Array.isArray(values)).toBe(true);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(`montant invalide: ${String(value)}`);
      }
      for (const sample of expandedSamples(value)) {
        assertSameParsers(sample, 'comma');
        assertSameParsers(sample, 'point');
      }
      for (const numberFormat of ['comma', 'point'] as const) {
        for (const digits of [0, 2, 4]) {
          assertRoundTrip(value, digits, numberFormat);
        }
      }
    }
  }, 120_000);
});
